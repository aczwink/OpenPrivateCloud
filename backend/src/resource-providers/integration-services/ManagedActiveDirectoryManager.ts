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
import os from "os";
import path from "path";
import { Injectable } from "acts-util-node";
import { LightweightResourceReference } from "../../common/ResourceReference";
import { DeploymentContext } from "../ResourceProvider";
import { ManagedActiveDirectoryProperties } from "./properties";
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
import { ResourceDependenciesController } from "../../data-access/ResourceDependenciesController";
import { ResourceEvent, ResourceEventListener, ResourceEventsManager } from "../../services/ResourceEventsManager";

export interface ADDC_Configuration
{
    /**
     * It is recommended to disable the "Administrator" account for security reasons. Its initial password is "AdminPW1234!".
     */
    enableAdministratorAccount: boolean;

    userNamingStrategy: "firstName";
}

export interface ADDC_Settings
{
    domain: string;
    dcIP_Address: string;
    vNetId: number;
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
export class ManagedActiveDirectoryManager implements ResourceEventListener
{
    constructor(private managedDockerContainerManager: ManagedDockerContainerManager, private resourcesManager: ResourcesManager, private resourceConfigController: ResourceConfigController,
        private distroInfoService: DistroInfoService, private remoteCommandExecutor: RemoteCommandExecutor, private hostNetworkInterfaceCardsManager: HostNetworkInterfaceCardsManager,
        private usersController: UsersController, private userCredentialsProvider: UserCredentialsProvider, private permissionsManager: PermissionsManager,
        private resourceDependenciesController: ResourceDependenciesController, resourceEventsManager: ResourceEventsManager)
    {
        resourceEventsManager.RegisterListener(this);
    }
    
    //Public methods
    public async DeleteResource(resourceReference: LightweightResourceReference)
    {
        await this.managedDockerContainerManager.DestroyContainer(resourceReference);
        await this.remoteCommandExecutor.ExecuteCommand(["sudo", "docker", "network", "rm", this.DeriveDockerStaticIPNetworkName(resourceReference)], resourceReference.hostId);

        const vlanInterfaceName = this.DeriveVLAN_SubInterfaceName(resourceReference);
        await this.hostNetworkInterfaceCardsManager.DeleteVLAN_SubInterface(resourceReference.hostId, vlanInterfaceName);

        await this.resourcesManager.RemoveResourceStorageDirectory(resourceReference);
    }

    public async ProvideResource(instanceProperties: ManagedActiveDirectoryProperties, context: DeploymentContext)
    {
        const vnetRef = await this.resourcesManager.CreateResourceReferenceFromExternalId(instanceProperties.vnetResourceId);

        await this.UpdateConfig(context.resourceReference.id, {
            config: {
                enableAdministratorAccount: true,
                userNamingStrategy: "firstName"
            },
            settings: {
                domain: instanceProperties.domain.toLowerCase(),
                dcIP_Address: instanceProperties.ipAddress,
                vNetId: vnetRef!.id
            },
            state: {
                userMapping: {}
            },
        });
        await this.resourcesManager.CreateResourceStorageDirectory(context.resourceReference);

        await this.resourceDependenciesController.SetResourceDependencies(context.resourceReference.id, [vnetRef!.id]);

        await this.CreateDockerStaticIPNetwork(context.resourceReference);
        this.UpdateServer(context.resourceReference);
    }

    public async QueryConfig(resourceReference: LightweightResourceReference)
    {
        const config = await this.ReadConfig(resourceReference.id);
        return config.config;
    }

    public async ReceiveResourceEvent(event: ResourceEvent): Promise<void>
    {
        if(event.type === "userCredentialsProvided")
        {
            const config = await this.ReadConfig(event.resourceId);

            const ref = await this.resourcesManager.CreateResourceReference(event.resourceId);
            if(ref === undefined)
                return; //resource might have been deleted in the mean time

            const userEntry = config.state.userMapping[event.userId];
            if(userEntry === undefined)
                return; //user might not exist anymore

            await this.SetUserPassword(ref!, userEntry.mappedName, event.secret);

            userEntry.state = "synchronized";
            await this.UpdateConfig(event.resourceId, config);
        }
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

    public async QueryHealthStatus(resourceReference: LightweightResourceReference)
    {
        return await this.managedDockerContainerManager.QueryHealthStatus(resourceReference);
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

    public async QueryLog(resourceReference: LightweightResourceReference)
    {
        return this.managedDockerContainerManager.QueryLog(resourceReference);
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

    private async CreateDockerStaticIPNetwork(resourceReference: LightweightResourceReference)
    {
        //unfortunately ipvlan interfaces can't be used to communicate between host and guest. this is by design. therefore we need the vnet integration to use the host as dns forwarder
        const netInterface = await this.hostNetworkInterfaceCardsManager.FindExternalNetworkInterface(resourceReference.hostId);
        const subnet = await this.hostNetworkInterfaceCardsManager.FindInterfaceSubnet(resourceReference.hostId, netInterface);
        const gateway = await this.hostNetworkInterfaceCardsManager.FindDefaultGateway(resourceReference.hostId);
        
        const vlanInterfaceName = this.DeriveVLAN_SubInterfaceName(resourceReference);
        await this.hostNetworkInterfaceCardsManager.CreateVLAN_SubInterface(resourceReference.hostId, vlanInterfaceName, netInterface);
        const networkName = this.DeriveDockerStaticIPNetworkName(resourceReference);
        await this.remoteCommandExecutor.ExecuteCommand(["sudo", "docker", "network", "create", "-d", "ipvlan", "--subnet", subnet.ToString(), "--gateway", gateway, "-o", "ipvlan_mode=l2", "-o", "parent=" + vlanInterfaceName, networkName], resourceReference.hostId);
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

    private DeriveDockerStaticIPNetworkName(resourceReference: LightweightResourceReference)
    {
        return "opc-rdsipnet" + resourceReference.id;
    }

    private DeriveVLAN_SubInterfaceName(resourceReference: LightweightResourceReference)
    {
        return "opcsip-" + resourceReference.id;
    }

    private async DoDeltaUserSynchronization(resourceReference: LightweightResourceReference)
    {
        const config = await this.ReadConfig(resourceReference.id);

        const desiredUserIds = await this.permissionsManager.QueryUsersWithPermission(resourceReference.id, resourceProviders.integrationServices.managedActiveDirectoryResourceType.permissions.use);
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
        
        this.userCredentialsProvider.SetResourceDependencies(resourceReference.id, desiredUserIds.ToArray(), true);
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
        //const imageName = (arch === "arm64") ? "ghcr.io/aczwink/samba-domain:latest" : "nowsci/samba-domain";
        const imageName = "ghcr.io/aczwink/samba-domain:latest";

        const vNetRef = await this.resourcesManager.CreateResourceReference(config.settings.vNetId);
        const dockerNetwork = await this.managedDockerContainerManager.ResolveVNetToDockerNetwork(vNetRef!);

        const dnsForwarderIP = dockerNetwork.primaryDNS_Server;

        const dcHostName = "dc1"; //hostname of the domain controller. DO NOT use name "LOCALDC", since it is a reserved name.

        const containerConfig: DockerContainerConfig = {
            additionalHosts: [
                {
                    domainName: dcHostName + "." + config.settings.domain,
                    ipAddress: config.settings.dcIP_Address
                }
            ],
            capabilities: ["NET_ADMIN", "SYS_NICE", "SYS_TIME"],
            cpuFraction: (os.cpus().length / 2),
            dnsSearchDomains: [config.settings.domain],
            dnsServers: [config.settings.dcIP_Address, dnsForwarderIP],
            env: [
                {
                    varName: "DNSFORWARDER",
                    value: dnsForwarderIP,
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
            hostName: dcHostName,
            imageName,
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

        const dockerNetworkSIPName = this.DeriveDockerStaticIPNetworkName(resourceReference);
        await this.managedDockerContainerManager.ConnectContainerToNetwork(resourceReference, dockerNetworkSIPName, { ipAddress: config.settings.dcIP_Address });
    }

    /**
     * Be aware that calling this, automatically enables a user!
     */
    private async SetUserPassword(resourceReference: LightweightResourceReference, mappedName: string, password: string)
    {
        const shell = await this.managedDockerContainerManager.SpawnShell(resourceReference);

        await shell.IssueCommand(["samba-tool", "user", "setpassword", mappedName]);

        await shell.Expect("New Password: ");
        shell.SendInputLine(password);
        await shell.Expect("Retype Password: ");
        shell.SendInputLine(password);

        await shell.WaitForCommandToFinish();

        await shell.ExitSession();
        
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
            this.userCredentialsProvider.SetResourceDependencies(resourceReference.id, createdUserIds, true);
    }

    private async SynchronizeDomainAdmins(resourceReference: LightweightResourceReference)
    {
        const desiredUserIds = await this.permissionsManager.QueryUsersWithPermission(resourceReference.id, resourceProviders.integrationServices.managedActiveDirectoryResourceType.permissions.manage);
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
}