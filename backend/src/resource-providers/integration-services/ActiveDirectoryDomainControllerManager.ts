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

export interface ADDC_Settings
{
    domain: string;
    dcHostName: string;
    dcIP_Address: string;
    dnsForwarderIP: string;
}

interface ADDC_Config
{
    settings: ADDC_Settings;
}

@Injectable
export class ActiveDirectoryDomainControllerManager
{
    constructor(private managedDockerContainerManager: ManagedDockerContainerManager, private resourcesManager: ResourcesManager, private resourceConfigController: ResourceConfigController)
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
        await this.UpdateConfig(context.resourceReference.id, {
            settings: {
                domain: instanceProperties.domain.toLowerCase(),
                dcHostName: instanceProperties.dcHostName,
                dcIP_Address: instanceProperties.ipAddress,
                dnsForwarderIP: instanceProperties.dnsForwarderIP
            }
        });
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

        const containerConfig: DockerContainerConfig = {
            additionalHosts: [
                {
                    domainName: config.settings.dcHostName + "." + config.settings.domain,
                    ipAddress: config.settings.dcIP_Address
                }
            ],
            capabilities: ["SYS_ADMIN"],
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
                    varName: "DOMAINPASS",
                    value: "AdminPW1234!"
                },
                {
                    varName: "HOSTIP",
                    value: config.settings.dcIP_Address
                }
            ],
            hostName: config.settings.dcHostName,
            imageName: "nowsci/samba-domain",
            networkName: "host",
            portMap: [],
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