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
import path from "path";
import { Injectable } from "acts-util-node";
import { UsersController } from "../../data-access/UsersController";
import { HostUsersManager } from "../../services/HostUsersManager";
import { InstancesManager } from "../../services/InstancesManager";
import { ModulesManager } from "../../services/ModulesManager";
import { RemoteFileSystemManager } from "../../services/RemoteFileSystemManager";
import { RemoteRootFileSystemManager } from "../../services/RemoteRootFileSystemManager";
import { SystemServicesManager } from "../../services/SystemServicesManager";
import { DeploymentContext } from "../ResourceProvider";
import { ApacheManager } from "./ApacheManager";
import { StaticWebsiteProperties } from "./Properties";
import { VirtualHost } from "./VirtualHost";
import { RemoteCommandExecutor } from "../../services/RemoteCommandExecutor";
import { InstancesController } from "../../data-access/InstancesController";
import { HostStoragesController } from "../../data-access/HostStoragesController";
import { TempFilesManager } from "../../services/TempFilesManager";

@Injectable
export class StaticWebsitesManager
{
    constructor(private modulesManager: ModulesManager, private instancesManager: InstancesManager,
        private hostUsersManager: HostUsersManager, private apacheManager: ApacheManager, private usersController: UsersController,
        private systemServicesManager: SystemServicesManager, private remoteRootFileSystemManager: RemoteRootFileSystemManager,
        private remoteFileSystemManager: RemoteFileSystemManager, private remoteCommandExecutor: RemoteCommandExecutor,
        private instancesController: InstancesController, private hostStoragesController: HostStoragesController,
        private tempFilesMangager: TempFilesManager)
    {
    }

    //Public methods
    public async DeleteResource(hostId: number, hostStoragePath: string, fullInstanceName: string)
    {
        const siteName = this.instancesManager.DeriveInstanceFileNameFromUniqueInstanceName(fullInstanceName);
        const site = await this.apacheManager.QuerySite(hostId, siteName);
        const port = parseInt(site.addresses.split(":")[1]);

        await this.apacheManager.DisableSite(hostId, siteName);
        await this.apacheManager.DisablePort(hostId, port);
        await this.systemServicesManager.RestartService(hostId, "apache2");

        await this.apacheManager.DeleteSite(hostId, siteName);
        
        await this.instancesManager.RemoveInstanceStorageDirectory(hostId, hostStoragePath, fullInstanceName);
    }

    public async ProvideResource(instanceProperties: StaticWebsiteProperties, context: DeploymentContext)
    {
        await this.modulesManager.EnsureModuleIsInstalled(context.hostId, "apache");

        const gid = await this.hostUsersManager.ResolveHostGroupId(context.hostId, "www-data");
        const uid = await this.hostUsersManager.ResolveHostUserId(context.hostId, "opc");

        const instanceDir = await this.instancesManager.CreateInstanceStorageDirectory(context.hostId, context.storagePath, context.fullInstanceName);
        await this.remoteRootFileSystemManager.ChangeOwnerAndGroup(context.hostId, instanceDir, uid, gid);

        const user = await this.usersController.QueryUser(context.userId);

        const vHost = VirtualHost.Default("*:" + instanceProperties.port, user!.emailAddress);
        vHost.properties.documentRoot = instanceDir;
        vHost.directories = [
            {
                path: instanceDir,
                require: "all granted",
            }
        ];

        const siteName = this.instancesManager.DeriveInstanceFileNameFromUniqueInstanceName(context.fullInstanceName);
        await this.apacheManager.CreateSite(context.hostId, siteName, vHost);
        await this.apacheManager.EnableSite(context.hostId, siteName);
        await this.apacheManager.EnablePort(context.hostId, instanceProperties.port);
        await this.systemServicesManager.RestartService(context.hostId, "apache2");
    }

    public async QueryPort(hostId: number, fullInstanceName: string)
    {
        const siteName = this.instancesManager.DeriveInstanceFileNameFromUniqueInstanceName(fullInstanceName);
        const vHost = await this.apacheManager.QuerySite(hostId, siteName);

        return parseInt(vHost.addresses.split(":")[1]);
    }

    public async UpdateContent(instanceId: number, buffer: Buffer)
    {
        const instance = await this.instancesController.QueryInstanceById(instanceId);
        const storage = await this.hostStoragesController.RequestHostStorage(instance!.storageId);
        const hostId = storage!.hostId;

        const instanceDir = this.instancesManager.BuildInstanceStoragePath(storage!.path, instance!.fullName);

        await this.CleanUpFolder(hostId, instanceDir);

        const zipFilePath = await this.tempFilesMangager.CreateFile(hostId, buffer);
        await this.remoteCommandExecutor.ExecuteCommand(["unzip", zipFilePath, "-d", instanceDir], hostId);
        await this.tempFilesMangager.Cleanup(hostId, zipFilePath);

        await this.SetPermissionsRecursive(hostId, instanceDir);
    }

    //Private methods
    private async CleanUpFolder(hostId: number, directoryPath: string)
    {
        const children = await this.remoteFileSystemManager.ListDirectoryContents(hostId, directoryPath);
        for (const child of children)
        {
            const childPath = path.join(directoryPath, child.filename);
            const status = await this.remoteFileSystemManager.QueryStatus(hostId, childPath);
            if(status.isDirectory())
                await this.remoteFileSystemManager.RemoveDirectoryRecursive(hostId, childPath);
            else
                await this.remoteFileSystemManager.UnlinkFile(hostId, childPath);
        }
    }

    private async SetPermissionsRecursive(hostId: number, dirPath: string)
    {
        const gid = await this.hostUsersManager.ResolveHostGroupId(hostId, "www-data");
        const uid = await this.hostUsersManager.ResolveHostUserId(hostId, "opc");

        const children = await this.remoteFileSystemManager.ListDirectoryContents(hostId, dirPath);
        for (const child of children)
        {
            const childPath = path.join(dirPath, child.filename);
            const status = await this.remoteFileSystemManager.QueryStatus(hostId, childPath);

            await this.remoteRootFileSystemManager.ChangeOwnerAndGroup(hostId, childPath, uid, gid);

            if(status.isDirectory())
            {
                await this.remoteFileSystemManager.ChangeMode(hostId, childPath, 0o750);
                await this.SetPermissionsRecursive(hostId, childPath);
            }
            else
                await this.remoteFileSystemManager.ChangeMode(hostId, childPath, 0o640);
        }
    }
}