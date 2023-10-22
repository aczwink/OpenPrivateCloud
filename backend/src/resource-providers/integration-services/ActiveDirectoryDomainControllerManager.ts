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
import { RemoteCommandExecutor } from "../../services/RemoteCommandExecutor";
import { HostNetworkInterfaceCardsManager } from "../../services/HostNetworkInterfaceCardsManager";

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
    constructor(private managedDockerContainerManager: ManagedDockerContainerManager, private resourcesManager: ResourcesManager, private resourceConfigController: ResourceConfigController,
        private distroInfoService: DistroInfoService, private remoteCommandExecutor: RemoteCommandExecutor, private hostNetworkInterfaceCardsManager: HostNetworkInterfaceCardsManager)
    {
    }
    
    //Public methods
    public async DeleteResource(resourceReference: LightweightResourceReference)
    {
        await this.managedDockerContainerManager.DestroyContainer(resourceReference);
        await this.remoteCommandExecutor.ExecuteCommand(["sudo", "docker", "network", "rm", this.DeriveDockerNetworkName(resourceReference)], resourceReference.hostId);

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
            },
        });
        await this.resourcesManager.CreateResourceStorageDirectory(context.resourceReference);

        await this.CreateDockerNetwork(context.resourceReference);
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
    private async CreateDockerNetwork(resourceReference: LightweightResourceReference)
    {
        //Unfortunately docker ipvlan networks are by design implemented in such a way, that the host and the container can't communicate. I.e. the container can communicate with the whole network and vice versa except the host itself.
        //see: https://superuser.com/questions/1736221/why-cant-i-ping-a-docker-container-from-the-host-when-using-ipvlan-in-l3-mode
        //if this ever becomes a limitation, apparently a new docker network plugin will be necessary :S

        const netInterface = await this.hostNetworkInterfaceCardsManager.FindExternalNetworkInterface(resourceReference.hostId);
        const subnet = await this.hostNetworkInterfaceCardsManager.FindInterfaceSubnet(resourceReference.hostId, netInterface);
        const gateway = await this.hostNetworkInterfaceCardsManager.FindDefaultGateway(resourceReference.hostId);
        const networkName = this.DeriveDockerNetworkName(resourceReference);
        await this.remoteCommandExecutor.ExecuteCommand(["sudo", "docker", "network", "create", "-d", "ipvlan", "--subnet", subnet.ToString(), "--gateway", gateway, "-o", "ipvlan_mode=l2", "-o", "parent=" + netInterface, networkName], resourceReference.hostId);
    }

    private DeriveDockerNetworkName(resourceReference: LightweightResourceReference)
    {
        return "opc-rdsipnet" + resourceReference.id;
    }

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

        const dockerNetworkName = this.DeriveDockerNetworkName(resourceReference);
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
            ipAddress: config.settings.dcIP_Address,
            networkName: dockerNetworkName,
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