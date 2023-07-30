/**
 * OpenPrivateCloud
 * Copyright (C) 2019-2023 Amir Czwink (amir130@hotmail.de)
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
import { Injectable } from "acts-util-node";
import path from "path";
import { HostUsersManager } from "../../services/HostUsersManager";
import { ResourcesManager } from "../../services/ResourcesManager";
import { ModulesManager } from "../../services/ModulesManager";
import { RemoteCommandExecutor } from "../../services/RemoteCommandExecutor";
import { RemoteFileSystemManager } from "../../services/RemoteFileSystemManager";
import { RemoteRootFileSystemManager } from "../../services/RemoteRootFileSystemManager";
import { SystemServicesManager } from "../../services/SystemServicesManager";
import { SharedFolderPermissionsManager } from "../file-services/SharedFolderPermissionsManager";
import { SingleSMBSharePerInstanceProvider } from "../file-services/SingleSMBSharePerInstanceProvider";
import { DeploymentContext, ResourceStateResult } from "../ResourceProvider";
import { JdownloaderProperties } from "./Properties";
import { LightweightResourceReference, ResourceReference } from "../../common/ResourceReference";

export interface MyJDownloaderCredentials
{
    email: string;
    /**
     * @format secret
     */
    password: string;
}
   
@Injectable
export class JdownloaderManager
{
    constructor(private modulesManager: ModulesManager, private hostUsersManager: HostUsersManager, private resourcesManager: ResourcesManager,
        private remoteCommandExecutor: RemoteCommandExecutor, private remoteFileSystemManager: RemoteFileSystemManager,
        private systemServicesManager: SystemServicesManager, private remoteRootFileSystemManager: RemoteRootFileSystemManager,
        private singleSMBSharePerInstanceProvider: SingleSMBSharePerInstanceProvider,
        private sharedFolderPermissionsManager: SharedFolderPermissionsManager)
    {
    }

    //Public methods
    public async DeleteResource(resourceReference: LightweightResourceReference)
    {
        const serviceName = "jdownloader";

        const running = await this.systemServicesManager.IsServiceActive(resourceReference.hostId, serviceName);
        if(running)
            await this.systemServicesManager.StopService(resourceReference.hostId, serviceName);
        const enabled = await this.systemServicesManager.IsServiceEnabled(resourceReference.hostId, serviceName);
        if(enabled)
            await this.systemServicesManager.DisableService(resourceReference.hostId, serviceName);
        await this.systemServicesManager.DeleteService(resourceReference.hostId, serviceName);

        await this.resourcesManager.RemoveResourceStorageDirectory(resourceReference);

        await this.hostUsersManager.DeleteHostServicePrincipal(resourceReference.hostId, "jdownloader");
    }

    public async GetSMBConnectionInfo(resourceReference: ResourceReference, userId: number)
    {
        return await this.singleSMBSharePerInstanceProvider.GetSMBConnectionInfo(resourceReference, userId);
    }

    public async IsActive(resourceReference: LightweightResourceReference)
    {
        return await this.systemServicesManager.IsServiceActive(resourceReference.hostId, "jdownloader");
    }

    public async ProvideResource(instanceProperties: JdownloaderProperties, context: DeploymentContext)
    {
        await this.modulesManager.EnsureModuleIsInstalled(context.hostId, "java");

        const resourceDir = await this.resourcesManager.CreateResourceStorageDirectory(context.resourceReference);
        await this.remoteFileSystemManager.ChangeMode(context.hostId, resourceDir, 0o775);

        const authority = await this.hostUsersManager.CreateHostServicePrincipal(context.hostId, "jdownloader");
        await this.remoteRootFileSystemManager.ChangeOwnerAndGroup(context.hostId, resourceDir, authority.hostUserId, authority.hostGroupId);

        const downloadsPath = path.join(resourceDir, "Downloads");
        await this.remoteFileSystemManager.CreateDirectory(context.hostId, downloadsPath);

        const shell = await this.remoteCommandExecutor.SpawnShell(context.hostId);
        await shell.ChangeUser(authority.linuxUserName);
        await shell.ChangeDirectory(resourceDir);

        await shell.ExecuteCommand(["wget", "http://installer.jdownloader.org/JDownloader.jar"]);
        await shell.ExecuteCommand(["java", "-Djava.awt.headless=true", "-jar", "JDownloader.jar", "-norestart"]);

        await shell.ExecuteCommand(["exit"]); //exit jdownloader user session

        await shell.Close();

        await this.systemServicesManager.CreateOrUpdateService(context.hostId, {
            command: "/usr/bin/java -Djava.awt.headless=true -jar " + resourceDir + "/JDownloader.jar",
            environment: {
                JD_HOME: resourceDir
            },
            groupName: authority.linuxGroupName,
            name: "JDownloader",
            userName: authority.linuxUserName
        });
    }

    public async QueryCredentials(resourceReference: ResourceReference): Promise<MyJDownloaderCredentials>
    {
        const myjd = await this.QueryMyJDownloaderSettings(resourceReference);
        
        return {
            email: myjd.email,
            password: myjd.password,
        };
    }

    public async QueryResourceState(resourceReference: LightweightResourceReference): Promise<ResourceStateResult>
    {
        const isActive = await this.IsActive(resourceReference);
        if(isActive)
            return "running";
        return "stopped";
    }

    public async RefreshPermissions(resourceReference: ResourceReference)
    {
        const instanceDir = this.resourcesManager.BuildResourceStoragePath(resourceReference);

        const downloadsPath = path.join(instanceDir, "Downloads");
        await this.sharedFolderPermissionsManager.SetPermissions(resourceReference, downloadsPath, true);

        await this.singleSMBSharePerInstanceProvider.UpdateSMBConfig({
            enabled: true,
            sharePath: path.join(instanceDir, "Downloads"),
            readOnly: true,
            transportEncryption: false
        }, resourceReference);
    }

    public async SetCredentials(resourceReference: ResourceReference, settings: MyJDownloaderCredentials)
    {
        const myjd = await this.QueryMyJDownloaderSettings(resourceReference);
        myjd.email = settings.email;
        myjd.password = settings.password;

        const configPath = this.BuildConfigPath(resourceReference);

        await this.remoteRootFileSystemManager.WriteTextFile(resourceReference.hostId, configPath, JSON.stringify(myjd));

        const sp = await this.hostUsersManager.ResolveHostServicePrinciple(resourceReference.hostId, "jdownloader");
        await this.remoteRootFileSystemManager.ChangeOwnerAndGroup(resourceReference.hostId, configPath, sp.hostUserId, sp.hostGroupId);

        const running = await this.systemServicesManager.IsServiceActive(resourceReference.hostId, "jdownloader");
        if(running)
            await this.systemServicesManager.RestartService(resourceReference.hostId, "jdownloader");
    }

    public async StartOrStopService(resourceReference: LightweightResourceReference, action: "start" | "stop")
    {
        if(action === "start")
            await this.systemServicesManager.StartService(resourceReference.hostId, "jdownloader");
        else
            await this.systemServicesManager.StopService(resourceReference.hostId, "jdownloader");
    }

    //Private methods
    private BuildConfigPath(resourceReference: LightweightResourceReference)
    {
        const resourcePath = this.resourcesManager.BuildResourceStoragePath(resourceReference);
        return path.join(resourcePath, "cfg/org.jdownloader.api.myjdownloader.MyJDownloaderSettings.json");
    }

    private async QueryMyJDownloaderSettings(resourceReference: ResourceReference)
    {
        const hostId = resourceReference.hostId;

        const configPath = this.BuildConfigPath(resourceReference);
        const exists = await this.remoteFileSystemManager.Exists(hostId, configPath);
        if(exists)
        {
            const data = await this.remoteFileSystemManager.ReadTextFile(hostId, configPath);
            const json = JSON.parse(data);

            return json;
        }

        return {
            email: "",
            password: "",
            autoconnectenabledv2: true,
            devicename: resourceReference.externalId
        };
    }
}