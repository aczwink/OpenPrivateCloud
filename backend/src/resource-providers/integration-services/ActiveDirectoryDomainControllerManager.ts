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
import { ActiveDirectoryDomainControllerProperties } from "./properties";
import { ManagedDockerContainerManager } from "../compute-services/ManagedDockerContainerManager";
import { DockerContainerConfig } from "../compute-services/DockerManager";
import { ResourcesManager } from "../../services/ResourcesManager";
import { ResourceConfigController } from "../../data-access/ResourceConfigController";
import { DistroInfoService } from "../../services/DistroInfoService";
import { ResourceDependenciesController } from "../../data-access/ResourceDependenciesController";

export interface ADDC_Settings
{
    domain: string;
    dcHostName: string;
    dcIP_Address: string;
    dnsForwarderIP: string;
}

interface ADDC_Config
{
    vNetId: number;
    settings: ADDC_Settings;
}

@Injectable
export class ActiveDirectoryDomainControllerManager
{
    constructor(private managedDockerContainerManager: ManagedDockerContainerManager, private resourcesManager: ResourcesManager, private resourceConfigController: ResourceConfigController,
        private distroInfoService: DistroInfoService, private resourceDependenciesController: ResourceDependenciesController)
    {
    }
    
    //Public methods
    public async DeleteResource(resourceReference: LightweightResourceReference)
    {
        await this.managedDockerContainerManager.DestroyContainer(resourceReference);

        await this.resourcesManager.RemoveResourceStorageDirectory(resourceReference);
    }

    public async ProvideResource(instanceProperties: ActiveDirectoryDomainControllerProperties, context: DeploymentContext)
    {
        const vnetRef = await this.resourcesManager.CreateResourceReferenceFromExternalId(instanceProperties.vnetResourceId);

        await this.UpdateConfig(context.resourceReference.id, {
            settings: {
                domain: instanceProperties.domain.toLowerCase(),
                dcHostName: instanceProperties.dcHostName,
                dcIP_Address: instanceProperties.ipAddress,
                dnsForwarderIP: instanceProperties.dnsForwarderIP
            },
            vNetId: vnetRef!.id
        });
        await this.resourceDependenciesController.SetResourceDependencies(context.resourceReference.id, [vnetRef!.id]);
        await this.resourcesManager.CreateResourceStorageDirectory(context.resourceReference);
        
        this.UpdateServer(context.resourceReference);
    }

    public async QueryInfo(resourceReference: LightweightResourceReference)
    {
        const config = await this.ReadConfig(resourceReference.id);
        const containerInfo = await this.managedDockerContainerManager.ExtractContainerInfo(resourceReference);
        return {
            config,
            containerInfo
        };
    }

    public async QueryResourceState(resourceReference: LightweightResourceReference): Promise<ResourceStateResult>
    {
        return await this.managedDockerContainerManager.QueryResourceState(resourceReference);
    }

    //Private methods
    private async ReadConfig(resourceId: number): Promise<ADDC_Config>
    {
        const config = await this.resourceConfigController.QueryConfig<ADDC_Config>(resourceId);
        return config!;
    }

    private async RestartServer(resourceReference: LightweightResourceReference, config: ADDC_Config)
    {
        const resourceDir = this.resourcesManager.BuildResourceStoragePath(resourceReference);

        const arch = await this.distroInfoService.FetchCPU_Architecture(resourceReference.hostId);
        const imageName = (arch === "arm64") ? "ghcr.io/aczwink/samba-domain:latest" : "nowsci/samba-domain";

        const vNetRef = await this.resourcesManager.CreateResourceReference(config.vNetId);
        const dockerNetwork = await this.managedDockerContainerManager.ResolveVNetToDockerNetwork(vNetRef!);
        const containerConfig: DockerContainerConfig = {
            additionalHosts: [
                {
                    domainName: config.settings.dcHostName + "." + config.settings.domain,
                    ipAddress: config.settings.dcIP_Address
                }
            ],
            capabilities: ["NET_ADMIN", "SYS_NICE", "SYS_TIME"],
            dnsSearchDomains: [config.settings.domain],
            dnsServers: [config.settings.dcIP_Address, config.settings.dnsForwarderIP],
            env: [
                {
                    varName: "DNSFORWARDER",
                    value: config.settings.dnsForwarderIP,
                },
                {
                    varName: "DOMAIN",
                    value: config.settings.domain.toUpperCase()
                },
                {
                    varName: "DOMAIN_DC",
                    value: config.settings.domain.split(".").map(x => "dc=" + x).join(",")
                },
                {
                    varName: "DOMAIN_EMAIL",
                    value: config.settings.domain,
                },
                {
                    varName: "DOMAINPASS",
                    value: "AdminPW1234!"
                },
                {
                    varName: "HOSTIP",
                    value: config.settings.dcIP_Address
                }
            ],
            hostName: config.settings.dcHostName,
            imageName,
            macAddress: this.managedDockerContainerManager.CreateMAC_Address(resourceReference.id),
            networkName: dockerNetwork.name,
            portMap: [],
            privileged: true,
            removeOnExit: false,
            restartPolicy: "always",
            volumes: [
                {
                    containerPath: "/etc/localtime",
                    hostPath: "/etc/localtime",
                    readOnly: true,
                },
                {
                    containerPath: "/var/lib/samba",
                    hostPath: path.join(resourceDir, "samba_data"),
                    readOnly: false,
                },
                {
                    containerPath: "/etc/samba/external",
                    hostPath: path.join(resourceDir, "samba_config"),
                    readOnly: false
                },
            ]
        };
        await this.managedDockerContainerManager.EnsureContainerIsRunning(resourceReference, containerConfig);
    }

    private async UpdateConfig(resourceId: number, config: ADDC_Config)
    {
        await this.resourceConfigController.UpdateOrInsertConfig(resourceId, config);
    }

    private async UpdateServer(resourceReference: LightweightResourceReference)
    {
        const config = await this.ReadConfig(resourceReference.id);

        await this.RestartServer(resourceReference, config);
    }
}