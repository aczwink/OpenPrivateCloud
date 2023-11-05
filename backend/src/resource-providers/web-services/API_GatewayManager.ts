/**
 * OpenPrivateCloud
 * Copyright (C) 2023 Amir Czwink (amir130@hotmail.de)
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 * 
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 * */
import path from "path";
import { Injectable } from "acts-util-node";
import { LightweightResourceReference } from "../../common/ResourceReference";
import { DeploymentContext, ResourceStateResult } from "../ResourceProvider";
import { API_GatewayProperties } from "./Properties";
import { ResourcesManager } from "../../services/ResourcesManager";
import { ResourceConfigController } from "../../data-access/ResourceConfigController";
import { RemoteFileSystemManager } from "../../services/RemoteFileSystemManager";
import { ManagedDockerContainerManager } from "../compute-services/ManagedDockerContainerManager";
import { DockerContainerConfig } from "../compute-services/DockerManager";
import { EqualsAny } from "acts-util-core";

export interface API_EntryConfig
{
    /**
     * Important: If you specify a path, the request path will be URL-decoded. To avoid that, specify only a host i.e. https://10.0.0.1:443 (notice the missing trailing slash).
     */
    backendURL: string;
    frontendDomainName: string;
    /**
     * @format byteSize
     * Define only if you want to override the service configuration value.
     */
    maxRequestBodySize?: number;
}

export interface API_GatewaySettings
{
    frontendPorts: number[];

    /**
     * @format byteSize
     */
    maxRequestBodySize: number;

    /**
     * @title Virtual network
     * @format instance-same-host[network-services/virtual-network]
     */
    vnetResourceExternalId: string;
}

interface API_GatewayConfig
{
    apiEntries: API_EntryConfig[];
    settings: API_GatewaySettings;
}

@Injectable
export class API_GatewayManager
{
    constructor(private resourcesManager: ResourcesManager, private resourceConfigController: ResourceConfigController, private remoteFileSystemManager: RemoteFileSystemManager,
        private managedDockerContainerManager: ManagedDockerContainerManager)
    {
    }

    //Public methods
    public async AddAPI(resourceReference: LightweightResourceReference, api: API_EntryConfig)
    {
        const config = await this.ReadConfig(resourceReference.id);
        config.apiEntries.push(api);
        await this.UpdateConfig(resourceReference.id, config);

        this.UpdateGateway(resourceReference);
    }

    public async DeleteAPI(resourceReference: LightweightResourceReference, api2delete: API_EntryConfig)
    {
        const config = await this.ReadConfig(resourceReference.id);

        const idx = config.apiEntries.findIndex(x => EqualsAny(x, api2delete));
        config.apiEntries.Remove(idx);
        
        await this.UpdateConfig(resourceReference.id, config);

        this.UpdateGateway(resourceReference);
    }

    public async DeleteResource(resourceReference: LightweightResourceReference)
    {
        await this.managedDockerContainerManager.DestroyContainer(resourceReference);

        await this.resourcesManager.RemoveResourceStorageDirectory(resourceReference);
    }

    public async ProvideResource(instanceProperties: API_GatewayProperties, context: DeploymentContext)
    {
        await this.UpdateConfig(context.resourceReference.id, {
            apiEntries: [],
            settings: {
                frontendPorts: [],
                maxRequestBodySize: 1 * 1024 * 1024, //1 MiB is default for nginx
                vnetResourceExternalId: instanceProperties.vnetResourceExternalId
            }
        });
        await this.resourcesManager.CreateResourceStorageDirectory(context.resourceReference);

        this.UpdateGateway(context.resourceReference);
    }

    public async QueryAPIs(resourceReference: LightweightResourceReference)
    {
        const config = await this.ReadConfig(resourceReference.id);
        return config.apiEntries;
    }

    public async QueryInfo(resourceReference: LightweightResourceReference)
    {
        return await this.managedDockerContainerManager.ExtractContainerInfo(resourceReference);
    }

    public async QueryLog(resourceReference: LightweightResourceReference)
    {
        return this.managedDockerContainerManager.QueryLog(resourceReference);
    }

    public async QueryResourceState(resourceReference: LightweightResourceReference): Promise<ResourceStateResult>
    {
        return await this.managedDockerContainerManager.QueryResourceState(resourceReference);
    }

    public async QuerySettings(resourceReference: LightweightResourceReference)
    {
        const config = await this.ReadConfig(resourceReference.id);
        return config.settings;
    }

    public async UpdateAPI(resourceReference: LightweightResourceReference, oldFrontendDomainName: string, newAPI_Props: API_EntryConfig)
    {
        const config = await this.ReadConfig(resourceReference.id);

        const idx = config.apiEntries.findIndex(x => x.frontendDomainName === oldFrontendDomainName);
        config.apiEntries.Remove(idx);
        config.apiEntries.push(newAPI_Props);
        
        await this.UpdateConfig(resourceReference.id, config);

        this.UpdateGateway(resourceReference);
    }

    public async UpdateSettings(resourceReference: LightweightResourceReference, settings: API_GatewaySettings)
    {
        const config = await this.ReadConfig(resourceReference.id);
        config.settings = settings;
        await this.UpdateConfig(resourceReference.id, config);
        this.UpdateGateway(resourceReference);
    }

    //Private methods
    private Generate404Config(config: API_GatewayConfig): string
    {
        const frontEndPorts = config.settings.frontendPorts.map(x => "listen\t" + x + ";").join("\n");
        return `
server {
    ${frontEndPorts}
    server_name  localhost;
    
    location / {
        root   /usr/share/nginx/html;
        index  404.html;
    }

    error_page   500 502 503 504  /50x.html;
    location = /50x.html {
        root   /usr/share/nginx/html;
    }
}
        `.trim();
    }

    private GenerateAPI_nginxConfig(settings: API_GatewaySettings, config: API_EntryConfig)
    {
        const frontEndPorts = settings.frontendPorts.map(x => "listen\t" + x + ";").join("\n");
        const maxBodySizeConfig = (config.maxRequestBodySize === undefined) ? settings.maxRequestBodySize : config.maxRequestBodySize;

        return `
server {
    ${frontEndPorts}
    server_name  ${config.frontendDomainName};
    client_max_body_size ${maxBodySizeConfig};

    location / {
        proxy_pass ${config.backendURL};
    }
    
    error_page   500 502 503 504  /50x.html;
    location = /50x.html {
        root   /usr/share/nginx/html;
    }
}
        `.trim();
    }

    private async ReadConfig(resourceId: number): Promise<API_GatewayConfig>
    {
        const config = await this.resourceConfigController.QueryConfig<API_GatewayConfig>(resourceId);
        return config!;
    }

    private async UpdateConfig(resourceId: number, config: API_GatewayConfig)
    {
        await this.resourceConfigController.UpdateOrInsertConfig(resourceId, config);
    }

    private async RestartGateway(resourceReference: LightweightResourceReference, resourceDir: string, config: API_GatewayConfig)
    {
        const vNetRef = await this.resourcesManager.CreateResourceReferenceFromExternalId(config.settings.vnetResourceExternalId);

        const dockerNetwork = await this.managedDockerContainerManager.ResolveVNetToDockerNetwork(vNetRef!);
        const containerConfig: DockerContainerConfig = {
            additionalHosts: [],
            capabilities: [],
            dnsSearchDomains: [],
            dnsServers: [dockerNetwork.primaryDNS_Server],
            env: [],
            macAddress: this.managedDockerContainerManager.CreateMAC_Address(resourceReference.id),
            imageName: "nginx:latest",
            networkName: dockerNetwork.name,
            portMap: [],
            privileged: false,
            removeOnExit: false,
            restartPolicy: "always",
            volumes: [
                {
                    containerPath: "/etc/nginx/conf.d",
                    hostPath: resourceDir,
                    readOnly: true
                }
            ]
        };
        await this.managedDockerContainerManager.EnsureContainerIsRunning(resourceReference, containerConfig);
    }

    private async UpdateGateway(resourceReference: LightweightResourceReference)
    {
        const resourceDir = this.resourcesManager.BuildResourceStoragePath(resourceReference);
        const config = await this.ReadConfig(resourceReference.id);

        const siteConfigs = config.apiEntries.map(x => this.GenerateAPI_nginxConfig(config.settings, x));
        siteConfigs.unshift(this.Generate404Config(config)); //nginx uses first server for everything that does not map to a valid domain name
        await this.remoteFileSystemManager.WriteTextFile(resourceReference.hostId, path.join(resourceDir, "default.conf"), siteConfigs.join("\n"));

        await this.RestartGateway(resourceReference, resourceDir, config);
    }
}