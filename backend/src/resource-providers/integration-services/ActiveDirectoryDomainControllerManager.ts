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
import { Dictionary } from "acts-util-core";
import { PublicUserData, UsersController } from "../../data-access/UsersController";
import { UserCredentialsProvider } from "../../services/UserCredentialsProvider";
import { PermissionsManager } from "../../services/PermissionsManager";
import { resourceProviders } from "openprivatecloud-common";

export interface ADDC_Configuration
{
    enableAdministratorAccount: boolean;
    userNamingStrategy: "firstName";
}

export interface ADDC_Settings
{
    domain: string;
    dcHostName: string;
    dcIP_Address: string;
    dnsForwarderIP: string;
}

interface ADDC_UserState
{
    mappedName: string;
    state: "created_but_locked" | "synchronized";
}

interface ADDC_State
{
    userMapping: Dictionary<ADDC_UserState>; //keys are userIds, which are stored as string in JSON
}

interface ADDC_Config
{
    config: ADDC_Configuration;
    settings: ADDC_Settings;
    state: ADDC_State;
}

//GPO documentation for samba: https://wiki.samba.org/index.php/Group_Policy

@Injectable
export class ActiveDirectoryDomainControllerManager
{
    constructor(private managedDockerContainerManager: ManagedDockerContainerManager, private resourcesManager: ResourcesManager, private resourceConfigController: ResourceConfigController,
        private distroInfoService: DistroInfoService, private remoteCommandExecutor: RemoteCommandExecutor, private hostNetworkInterfaceCardsManager: HostNetworkInterfaceCardsManager,
        private usersController: UsersController, private userCredentialsProvider: UserCredentialsProvider, private permissionsManager: PermissionsManager)
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
            config: {
                enableAdministratorAccount: true,
                userNamingStrategy: "firstName"
            },
            settings: {
                domain: instanceProperties.domain.toLowerCase(),
                dcHostName: instanceProperties.dcHostName,
                dcIP_Address: instanceProperties.ipAddress,
                dnsForwarderIP: instanceProperties.dnsForwarderIP
            },
            state: {
                userMapping: {}
            },
        });
        await this.resourcesManager.CreateResourceStorageDirectory(context.resourceReference);

        await this.CreateDockerNetwork(context.resourceReference);
        this.UpdateServer(context.resourceReference);
    }

    public async QueryConfig(resourceReference: LightweightResourceReference)
    {
        const config = await this.ReadConfig(resourceReference.id);
        return config.config;
    }

    public async ResourcePermissionsChanged(resourceReference: LightweightResourceReference)
    {
        await this.DoDeltaUserSynchronization(resourceReference);
        await this.SynchronizeDomainAdmins(resourceReference);
    }

    public async UpdateDCConfig(resourceReference: LightweightResourceReference, newConfiguration: ADDC_Configuration)
    {
        const config = await this.ReadConfig(resourceReference.id);
        const oldUserNamingStrategy = config.config.userNamingStrategy;

        config.config = newConfiguration;

        await this.UpdateConfig(resourceReference.id, config);

        await this.managedDockerContainerManager.ExecuteCommandInContainer(resourceReference, ["samba-tool", "user", newConfiguration.enableAdministratorAccount ? "enable" : "disable", "administrator"]);

        if(oldUserNamingStrategy !== newConfiguration.userNamingStrategy)
            await this.DoFullUserSynchronization(resourceReference);
    }

    public async QueryInfo(resourceReference: LightweightResourceReference)
    {
        const config = await this.ReadConfig(resourceReference.id);
        const containerInfo = await this.managedDockerContainerManager.ExtractContainerInfo(resourceReference);
        return {
            config: config.settings,
            containerInfo
        };
    }

    public async QueryResourceState(resourceReference: LightweightResourceReference): Promise<ResourceStateResult>
    {
        return await this.managedDockerContainerManager.QueryResourceState(resourceReference);
    }

    public async QueryUsers(resourceReference: LightweightResourceReference)
    {
        const config = await this.ReadConfig(resourceReference.id);
        return config.state.userMapping;
    }

    //Private methods
    private CreateMappedUserName(user: PublicUserData, config: ADDC_Configuration)
    {
        switch(config.userNamingStrategy)
        {
            case "firstName":
                return user.firstName;
        }
    }

    private async CreateUserEntryIfNotExisting(user: PublicUserData, config: ADDC_Config, resourceReference: LightweightResourceReference)
    {
        if(user.id in config.state.userMapping)
            return false;

        const mappedName = this.CreateMappedUserName(user, config.config);

        const options = [
            "--given-name", user.firstName,
            "--mail-address", (mappedName + "@" + config.settings.domain),
            "--random-password"
        ];

        await this.managedDockerContainerManager.ExecuteCommandInContainer(resourceReference, ["samba-tool", "user", "add", mappedName, ...options]);
        config.state.userMapping[user.id] = {
            state: "created_but_locked",
            mappedName
        };

        await this.managedDockerContainerManager.ExecuteCommandInContainer(resourceReference, ["samba-tool", "user", "disable", mappedName]);
        await this.managedDockerContainerManager.ExecuteCommandInContainer(resourceReference, ["samba-tool", "user", "setexpiry", mappedName, "--noexpiry"]);

        return true;
    }

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

    private async DeleteAllUsers(resourceReference: LightweightResourceReference)
    {
        const config = await this.ReadConfig(resourceReference.id);

        for (const userId in config.state.userMapping)
        {
            if (Object.prototype.hasOwnProperty.call(config.state.userMapping, userId))
            {
                const user = config.state.userMapping[userId]!;

                await this.managedDockerContainerManager.ExecuteCommandInContainer(resourceReference, ["samba-tool", "user", "delete", user.mappedName]);
            }
        }

        config.state.userMapping = {};
        await this.UpdateConfig(resourceReference.id, config);
    }

    private DeriveDockerNetworkName(resourceReference: LightweightResourceReference)
    {
        return "opc-rdsipnet" + resourceReference.id;
    }

    private async DoDeltaUserSynchronization(resourceReference: LightweightResourceReference)
    {
        const config = await this.ReadConfig(resourceReference.id);

        const desiredUserIds = await this.permissionsManager.QueryUsersWithPermission(resourceReference.id, resourceProviders.integrationServices.activeDirectoryDomainControllerResourceType.permissions.use);
        const currentUserIds = config.state.userMapping.OwnKeys().Map(x => parseInt(x.toString())).ToSet();
        const toDelete = currentUserIds.Without(desiredUserIds);

        for (const userId of toDelete)
        {
            const user = config.state.userMapping[userId]!;
            await this.managedDockerContainerManager.ExecuteCommandInContainer(resourceReference, ["samba-tool", "user", "delete", user.mappedName]);
            delete config.state.userMapping[userId];
        }

        const createdUserIds = [];
        for (const userId of desiredUserIds)
        {
            const user = await this.usersController.QueryUser(userId);
            const created = await this.CreateUserEntryIfNotExisting(user!, config, resourceReference);
            if(created)
                createdUserIds.push(user!.id);
        }

        await this.UpdateConfig(resourceReference.id, config);

        for (const userId of createdUserIds)
            this.userCredentialsProvider.RegisterForUserCredentialProvision(userId, resourceReference.id, this.OnUserCredentialsProvided.bind(this));
    }

    private async DoFullUserSynchronization(resourceReference: LightweightResourceReference)
    {
        await this.DeleteAllUsers(resourceReference);
        await this.SyncAllUsers(resourceReference);
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

    /**
     * Be aware that calling this, automatically enables a user!
     */
    private async SetUserPassword(resourceReference: LightweightResourceReference, mappedName: string, password: string)
    {
        const shell = await this.managedDockerContainerManager.SpawnShell(resourceReference);

        //TODO: avoid password being visible
        shell.StartCommand(["samba-tool", "user", "setpassword", mappedName]);
        await new Promise( resolve => {
            setTimeout(resolve, 1000);
        }); //wait a little for the password prompt, TODO: implement expect functionality
        shell.SendInputLine(password);

        await new Promise( resolve => {
            setTimeout(resolve, 1000);
        }); //wait a little for the password prompt, TODO: implement expect functionality
        shell.SendInputLine(password);

        await shell.WaitForCommandToFinish();

        await shell.Close();
        
    }

    private async SyncAllUsers(resourceReference: LightweightResourceReference)
    {
        const config = await this.ReadConfig(resourceReference.id);

        const createdUserIds = [];
        const users = await this.usersController.QueryUsers();
        for (const user of users)
        {
            const created = await this.CreateUserEntryIfNotExisting(user, config, resourceReference);
            if(created)
                createdUserIds.push(user.id);
        }
        
        await this.UpdateConfig(resourceReference.id, config);

        for (const userId of createdUserIds)
            this.userCredentialsProvider.RegisterForUserCredentialProvision(userId, resourceReference.id, this.OnUserCredentialsProvided.bind(this));
    }

    private async SynchronizeDomainAdmins(resourceReference: LightweightResourceReference)
    {
        const desiredUserIds = await this.permissionsManager.QueryUsersWithPermission(resourceReference.id, resourceProviders.integrationServices.activeDirectoryDomainControllerResourceType.permissions.manage);
        const config = await this.ReadConfig(resourceReference.id);

        const desiredUserNames = desiredUserIds.Values().Map(userId => config.state.userMapping[userId]!.mappedName).ToSet();
        desiredUserNames.add("Administrator"); //the domain admin is always in this group

        const result = await this.managedDockerContainerManager.ExecuteBufferedCommandInContainer(resourceReference, ["samba-tool", "group", "listmembers", "Domain Admins"]);
        const currentMembers = result.stdOut.trimEnd().split("\n");
        const currentMembersSet = new Set(currentMembers);

        const toAdd = desiredUserNames.Without(currentMembersSet);
        const toDelete = currentMembersSet.Without(desiredUserNames);

        if(toAdd.size > 0)
            await this.managedDockerContainerManager.ExecuteCommandInContainer(resourceReference, ["samba-tool", "group", "addmembers", "Domain Admins", toAdd.Values().Join(",")]);
        if(toDelete.size > 0)
            await this.managedDockerContainerManager.ExecuteCommandInContainer(resourceReference, ["samba-tool", "group", "removemembers", "Domain Admins", toDelete.Values().Join(",")]);
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

    //Event handlers
    private async OnUserCredentialsProvided(userId: number, password: string, resourceId: number)
    {
        const config = await this.ReadConfig(resourceId);

        const ref = await this.resourcesManager.CreateResourceReference(resourceId);
        if(ref === undefined)
            return; //resource might have been deleted in the mean time

        const userEntry = config.state.userMapping[userId];
        if(userEntry === undefined)
            return; //user might not exist anymore

        await this.SetUserPassword(ref!, userEntry.mappedName, password);

        userEntry.state = "synchronized";
        await this.UpdateConfig(resourceId, config);
    }
}