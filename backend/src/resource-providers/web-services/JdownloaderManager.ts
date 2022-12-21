/**
 * OpenPrivateCloud
 * Copyright (C) 2019-2022 Amir Czwink (amir130@hotmail.de)
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
import { InstanceContext } from "../../common/InstanceContext";
import { HostStoragesController } from "../../data-access/HostStoragesController";
import { InstancesController } from "../../data-access/InstancesController";
import { HostUsersManager } from "../../services/HostUsersManager";
import { InstancesManager } from "../../services/InstancesManager";
import { ModulesManager } from "../../services/ModulesManager";
import { RemoteCommandExecutor } from "../../services/RemoteCommandExecutor";
import { RemoteFileSystemManager } from "../../services/RemoteFileSystemManager";
import { RemoteRootFileSystemManager } from "../../services/RemoteRootFileSystemManager";
import { SystemServicesManager } from "../../services/SystemServicesManager";
import { SharedFolderPermissionsManager } from "../file-services/SharedFolderPermissionsManager";
import { SingleSMBSharePerInstanceProvider } from "../file-services/SingleSMBSharePerInstanceProvider";
import { DeploymentContext } from "../ResourceProvider";
import { JdownloaderProperties } from "./Properties";

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
    constructor(private modulesManager: ModulesManager, private hostUsersManager: HostUsersManager, private instancesManager: InstancesManager,
        private remoteCommandExecutor: RemoteCommandExecutor, private remoteFileSystemManager: RemoteFileSystemManager,
        private systemServicesManager: SystemServicesManager, private remoteRootFileSystemManager: RemoteRootFileSystemManager,
        private instancesController: InstancesController, private hostStoragesController: HostStoragesController,
        private singleSMBSharePerInstanceProvider: SingleSMBSharePerInstanceProvider,
        private sharedFolderPermissionsManager: SharedFolderPermissionsManager)
    {
    }

    //Public methods
    public async DeleteResource(hostId: number, hostStoragePath: string, fullInstanceName: string)
    {
        const serviceName = "jdownloader";

        const running = await this.systemServicesManager.IsServiceActive(hostId, serviceName);
        if(running)
            await this.systemServicesManager.StopService(hostId, serviceName);
        const enabled = await this.systemServicesManager.IsServiceEnabled(hostId, serviceName);
        if(enabled)
            await this.systemServicesManager.DisableService(hostId, serviceName);
        await this.systemServicesManager.DeleteService(hostId, serviceName);

        await this.instancesManager.RemoveInstanceStorageDirectory(hostId, hostStoragePath, fullInstanceName);

        await this.hostUsersManager.DeleteHostServicePrincipal(hostId, "jdownloader");
    }

    public async GetSMBConnectionInfo(data: InstanceContext, userId: number)
    {
        return await this.singleSMBSharePerInstanceProvider.GetSMBConnectionInfo(data, userId);
    }

    public async IsActive(instanceId: number)
    {
        const instanceData = await this.QueryInstanceData(instanceId);
        return await this.systemServicesManager.IsServiceActive(instanceData.hostId, "jdownloader");
    }

    public async ProvideResource(instanceProperties: JdownloaderProperties, context: DeploymentContext)
    {
        await this.modulesManager.EnsureModuleIsInstalled(context.hostId, "java");

        const instanceDir = await this.instancesManager.CreateInstanceStorageDirectory(context.hostId, context.storagePath, context.fullInstanceName);
        await this.remoteFileSystemManager.ChangeMode(context.hostId, instanceDir, 0o775);

        const authority = await this.hostUsersManager.CreateHostServicePrincipal(context.hostId, "jdownloader");
        await this.remoteRootFileSystemManager.ChangeOwnerAndGroup(context.hostId, instanceDir, authority.hostUserId, authority.hostGroupId);

        const downloadsPath = path.join(instanceDir, "Downloads");
        await this.remoteFileSystemManager.CreateDirectory(context.hostId, downloadsPath);

        const shell = await this.remoteCommandExecutor.SpawnShell(context.hostId);
        await shell.ChangeUser(authority.linuxUserName);
        await shell.ChangeDirectory(instanceDir);

        await shell.ExecuteCommand(["wget", "http://installer.jdownloader.org/JDownloader.jar"]);
        await shell.ExecuteCommand(["java", "-Djava.awt.headless=true", "-jar", "JDownloader.jar", "-norestart"]);

        await shell.ExecuteCommand(["exit"]); //exit jdownloader user session

        await shell.Close();

        await this.systemServicesManager.CreateService(context.hostId, {
            command: "/usr/bin/java -Djava.awt.headless=true -jar " + instanceDir + "/JDownloader.jar",
            environment: {
                JD_HOME: instanceDir
            },
            groupName: authority.linuxGroupName,
            name: "JDownloader",
            userName: authority.linuxUserName
        });
    }

    public async QueryCredentials(instanceId: number): Promise<MyJDownloaderCredentials>
    {
        const myjd = await this.QueryMyJDownloaderSettings(instanceId);
        
        return {
            email: myjd.email,
            password: myjd.password,
        };
    }

    public async RefreshPermissions(instanceContext: InstanceContext)
    {
        const instanceDir = this.instancesManager.BuildInstanceStoragePath(instanceContext.hostStoragePath, instanceContext.fullInstanceName);

        const downloadsPath = path.join(instanceDir, "Downloads");
        await this.sharedFolderPermissionsManager.SetPermissions(instanceContext, downloadsPath, true);

        await this.singleSMBSharePerInstanceProvider.UpdateSMBConfig({
            enabled: true,
            sharePath: path.join(instanceDir, "Downloads"),
            readOnly: true
        }, instanceContext);
    }

    public async SetCredentials(instanceId: number, settings: MyJDownloaderCredentials)
    {
        const myjd = await this.QueryMyJDownloaderSettings(instanceId);
        myjd.email = settings.email;
        myjd.password = settings.password;

        const instanceData = await this.QueryInstanceData(instanceId);
        const configPath = this.BuildConfigPath(instanceData.hostStoragePath, instanceData.fullInstanceName);

        await this.remoteRootFileSystemManager.WriteTextFile(instanceData.hostId, configPath, JSON.stringify(myjd));

        const sp = await this.hostUsersManager.ResolveHostServicePrinciple(instanceData.hostId, "jdownloader");
        await this.remoteRootFileSystemManager.ChangeOwnerAndGroup(instanceData.hostId, configPath, sp.hostUserId, sp.hostGroupId);

        const running = await this.systemServicesManager.IsServiceActive(instanceData.hostId, "jdownloader");
        if(running)
            await this.systemServicesManager.RestartService(instanceData.hostId, "jdownloader");
    }

    public async StartOrStopService(instanceId: number, action: "start" | "stop")
    {
        const instanceData = await this.QueryInstanceData(instanceId);

        if(action === "start")
            await this.systemServicesManager.StartService(instanceData.hostId, "jdownloader");
        else
            await this.systemServicesManager.StopService(instanceData.hostId, "jdownloader");
    }

    //Private methods
    private BuildConfigPath(hostStoragePath: string, fullInstanceName: string)
    {
        const instancePath = this.instancesManager.BuildInstanceStoragePath(hostStoragePath, fullInstanceName);
        return path.join(instancePath, "cfg/org.jdownloader.api.myjdownloader.MyJDownloaderSettings.json");
    }

    private async QueryInstanceData(instanceId: number)
    {
        const instance = await this.instancesController.QueryInstanceById(instanceId);
        const storage = await this.hostStoragesController.RequestHostStorage(instance!.storageId);

        return {
            hostId: storage!.hostId,
            hostStoragePath: storage!.path,
            fullInstanceName: instance!.fullName
        };
    }

    private async QueryMyJDownloaderSettings(instanceId: number)
    {
        const instanceData = await this.QueryInstanceData(instanceId);
        const hostId = instanceData.hostId;

        const configPath = this.BuildConfigPath(instanceData.hostStoragePath, instanceData.fullInstanceName);
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
            devicename: instanceData.fullInstanceName
        };
    }
}