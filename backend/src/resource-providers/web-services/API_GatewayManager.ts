/**
 * OpenPrivateCloud
 * Copyright (C) 2023-2024 Amir Czwink (amir130@hotmail.de)
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
import { DeploymentContext } from "../ResourceProvider";
import { API_GatewayProperties } from "./Properties";
import { ResourcesManager } from "../../services/ResourcesManager";
import { ResourceConfigController } from "../../data-access/ResourceConfigController";
import { RemoteFileSystemManager } from "../../services/RemoteFileSystemManager";
import { ManagedDockerContainerManager } from "../compute-services/ManagedDockerContainerManager";
import { DockerContainerConfig, DockerContainerConfigVolume } from "../compute-services/DockerManager";
import { ResourceDependenciesController } from "../../data-access/ResourceDependenciesController";
import { KeyVaultManager } from "../security-services/KeyVaultManager";

export interface API_EntryConfig
{
    /**
     * Important: If you specify a path, the request path will be URL-decoded. To avoid that, specify only a host i.e. https://10.0.0.1:443 (notice the missing trailing slash).
     */
    backendURL: string;
    frontendDomainName: string;
    /**
     * Define only if you want to override the service configuration value.
     * @format byteSize
     */
    maxRequestBodySize?: number;
}

interface API_GatewaySettings
{
    certificate?: {
        keyVaultId: number;
        certificateName: string;
    };

    frontendPorts: number[];

    /**
     * @format byteSize
     */
    maxRequestBodySize: number;

    vnetResourceId: number;
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
        private managedDockerContainerManager: ManagedDockerContainerManager, private resourceDependenciesController: ResourceDependenciesController,
        private keyVaultManager: KeyVaultManager)
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

        const idx = config.apiEntries.findIndex(x => x.frontendDomainName === api2delete.frontendDomainName);
        if(idx === -1)
            return false;
        config.apiEntries.Remove(idx);
        
        await this.UpdateConfig(resourceReference.id, config);

        this.UpdateGateway(resourceReference);

        return true;
    }

    public async DeleteResource(resourceReference: LightweightResourceReference)
    {
        await this.managedDockerContainerManager.DestroyContainer(resourceReference);

        await this.resourcesManager.RemoveResourceStorageDirectory(resourceReference);
    }

    public async ProvideResource(resourceProperties: API_GatewayProperties, context: DeploymentContext)
    {
        const vnetRef = await this.resourcesManager.CreateResourceReferenceFromExternalId(resourceProperties.vnetResourceExternalId);

        await this.UpdateConfig(context.resourceReference.id, {
            apiEntries: [],
            settings: {
                frontendPorts: [],
                maxRequestBodySize: 1 * 1024 * 1024, //1 MiB is default for nginx
                vnetResourceId: vnetRef!.id,
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

    public async QueryHealthStatus(resourceReference: LightweightResourceReference)
    {
        return await this.managedDockerContainerManager.QueryHealthStatus(resourceReference);
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
        const listen = this.GenerateListenStatements(config.settings);
        const ssl = this.GenerateSSLStatements(config.settings);

        return `
server {
    ${listen}
    server_name  localhost;
    ${ssl}
    
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
        const listen = this.GenerateListenStatements(settings);
        const maxBodySizeConfig = (config.maxRequestBodySize === undefined) ? settings.maxRequestBodySize : config.maxRequestBodySize;
        const ssl = this.GenerateSSLStatements(settings);

        return `
server {
    ${listen}
    server_name  ${config.frontendDomainName};
    client_max_body_size ${maxBodySizeConfig};
    ${ssl}

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

    private GenerateListenStatements(settings: API_GatewaySettings)
    {
        const wantSSL = (settings.certificate === undefined) ? "" : " ssl";
        const frontEndPorts = settings.frontendPorts.map(x => "listen\t" + x + wantSSL + ";").join("\n");
        return frontEndPorts;
    }

    private GenerateSSLStatements(settings: API_GatewaySettings)
    {
        if(settings.certificate === undefined)
            return "";

        const paths = this.GetContainerCertificateMountPoint();

        return `
        ssl_certificate ${paths.certPath};
        ssl_certificate_key ${paths.keyPath};
        `;
    }

    private GetContainerCertificateMountPoint()
    {
        return {
            certPath: "/srv/public.crt",
            keyPath: "/srv/private.key",
        };
    }

    private async ReadConfig(resourceId: number): Promise<API_GatewayConfig>
    {
        const config = await this.resourceConfigController.QueryConfig<API_GatewayConfig>(resourceId);
        return config!;
    }

    private async UpdateConfig(resourceId: number, config: API_GatewayConfig)
    {
        await this.resourceConfigController.UpdateOrInsertConfig(resourceId, config);

        const dependencies = [config.settings.vnetResourceId];
        if(config.settings.certificate !== undefined)
            dependencies.push(config.settings.certificate.keyVaultId);
        await this.resourceDependenciesController.SetResourceDependencies(resourceId, dependencies);
    }

    private async RestartGateway(resourceReference: LightweightResourceReference, resourceDir: string, config: API_GatewayConfig)
    {
        const vNetRef = await this.resourcesManager.CreateResourceReference(config.settings.vnetResourceId);

        const volumes: DockerContainerConfigVolume[] = [
            {
                containerPath: "/etc/nginx/conf.d",
                hostPath: resourceDir,
                readOnly: true
            }
        ];

        if(config.settings.certificate !== undefined)
        {
            const kvRef = await this.resourcesManager.CreateResourceReference(config.settings.certificate.keyVaultId);
            const hostPaths = await this.keyVaultManager.QueryCertificatePaths(kvRef!, config.settings.certificate.certificateName);
            const containerPaths = this.GetContainerCertificateMountPoint();

            volumes.push({
                containerPath: containerPaths.certPath,
                hostPath: hostPaths.certPath,
                readOnly: true
            });
            volumes.push({
                containerPath: containerPaths.keyPath,
                hostPath: hostPaths.keyPath,
                readOnly: true
            });
        }

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
            volumes
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