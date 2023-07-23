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
import path from "path";
import { Injectable } from "acts-util-node";
import { UsersController } from "../../data-access/UsersController";
import { HostUsersManager } from "../../services/HostUsersManager";
import { ResourcesManager } from "../../services/ResourcesManager";
import { ModulesManager } from "../../services/ModulesManager";
import { RemoteFileSystemManager } from "../../services/RemoteFileSystemManager";
import { RemoteRootFileSystemManager } from "../../services/RemoteRootFileSystemManager";
import { SystemServicesManager } from "../../services/SystemServicesManager";
import { DeploymentContext } from "../ResourceProvider";
import { ApacheManager } from "./ApacheManager";
import { StaticWebsiteProperties } from "./Properties";
import { VirtualHost } from "./VirtualHost";
import { RemoteCommandExecutor } from "../../services/RemoteCommandExecutor";
import { TempFilesManager } from "../../services/TempFilesManager";
import { linuxSpecialGroups, opcSpecialUsers } from "../../common/UserAndGroupDefinitions";
import { LightweightResourceReference } from "../../common/ResourceReference";

export interface StaticWebsiteConfig
{
    defaultRoute?: string;
}

@Injectable
export class StaticWebsitesManager
{
    constructor(private modulesManager: ModulesManager, private resourcesManager: ResourcesManager,
        private hostUsersManager: HostUsersManager, private apacheManager: ApacheManager, private usersController: UsersController,
        private systemServicesManager: SystemServicesManager, private remoteRootFileSystemManager: RemoteRootFileSystemManager,
        private remoteFileSystemManager: RemoteFileSystemManager, private remoteCommandExecutor: RemoteCommandExecutor,
        private tempFilesMangager: TempFilesManager)
    {
    }

    //Public methods
    public async DeleteResource(resourceReference: LightweightResourceReference)
    {
        const siteName = this.DeriveSiteName(resourceReference);
        const site = await this.apacheManager.QuerySite(resourceReference.hostId, siteName);
        const port = parseInt(site.addresses.split(":")[1]);

        await this.apacheManager.DisableSite(resourceReference.hostId, siteName);
        await this.apacheManager.DisablePort(resourceReference.hostId, port);
        await this.systemServicesManager.RestartService(resourceReference.hostId, "apache2");

        await this.apacheManager.DeleteSite(resourceReference.hostId, siteName);

        await this.resourcesManager.RemoveResourceStorageDirectory(resourceReference);
    }

    public async ProvideResource(instanceProperties: StaticWebsiteProperties, context: DeploymentContext)
    {
        await this.modulesManager.EnsureModuleIsInstalled(context.hostId, "apache");

        const gid = await this.hostUsersManager.ResolveHostGroupId(context.hostId, linuxSpecialGroups["www-data"]);
        const uid = await this.hostUsersManager.ResolveHostUserId(context.hostId, opcSpecialUsers.host);

        const instanceDir = await this.resourcesManager.CreateResourceStorageDirectory(context.resourceReference);
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

        const siteName = this.DeriveSiteName(context.resourceReference)
        await this.apacheManager.CreateSite(context.hostId, siteName, vHost);
        await this.apacheManager.EnableSite(context.hostId, siteName);
        await this.apacheManager.EnablePort(context.hostId, instanceProperties.port);
        await this.systemServicesManager.RestartService(context.hostId, "apache2");
    }

    public async QueryConfig(resourceReference: LightweightResourceReference): Promise<StaticWebsiteConfig>
    {
        const siteName = this.DeriveSiteName(resourceReference);
        const vHost = await this.apacheManager.QuerySite(resourceReference.hostId, siteName);

        return {
            defaultRoute: vHost.directories[0].fallbackResource
        };
    }

    public async QueryPort(resourceReference: LightweightResourceReference)
    {
        const siteName = this.DeriveSiteName(resourceReference);
        const vHost = await this.apacheManager.QuerySite(resourceReference.hostId, siteName);

        return parseInt(vHost.addresses.split(":")[1]);
    }

    public async UpdateConfig(resourceReference: LightweightResourceReference, config: StaticWebsiteConfig)
    {
        const siteName = this.DeriveSiteName(resourceReference);
        const vHost = await this.apacheManager.QuerySite(resourceReference.hostId, siteName);

        vHost.directories[0].fallbackResource = config.defaultRoute;

        this.apacheManager.SetSite(resourceReference.hostId, siteName, vHost);
        await this.systemServicesManager.RestartService(resourceReference.hostId, "apache2");
    }

    public async UpdateContent(resourceReference: LightweightResourceReference, buffer: Buffer)
    {
        const hostId = resourceReference.hostId;

        const resourceDir = this.resourcesManager.BuildResourceStoragePath(resourceReference);

        await this.CleanUpFolder(hostId, resourceDir);

        const zipFilePath = await this.tempFilesMangager.CreateFile(hostId, buffer);
        await this.remoteCommandExecutor.ExecuteCommand(["unzip", zipFilePath, "-d", resourceDir], hostId);
        await this.tempFilesMangager.Cleanup(hostId, zipFilePath);

        await this.SetPermissionsRecursive(hostId, resourceDir);
    }

    //Private methods
    private async CleanUpFolder(hostId: number, directoryPath: string)
    {
        const children = await this.remoteFileSystemManager.ListDirectoryContents(hostId, directoryPath);
        for (const child of children)
        {
            const childPath = path.join(directoryPath, child);
            const status = await this.remoteFileSystemManager.QueryStatus(hostId, childPath);
            if(status.isDirectory())
                await this.remoteFileSystemManager.RemoveDirectoryRecursive(hostId, childPath);
            else
                await this.remoteFileSystemManager.UnlinkFile(hostId, childPath);
        }
    }

    private DeriveSiteName(resourceReference: LightweightResourceReference)
    {
        return "opc-rsw-" + resourceReference.id;
    }

    private async SetPermissionsRecursive(hostId: number, dirPath: string)
    {
        const gid = await this.hostUsersManager.ResolveHostGroupId(hostId, linuxSpecialGroups["www-data"]);
        const uid = await this.hostUsersManager.ResolveHostUserId(hostId, opcSpecialUsers.host);

        const children = await this.remoteFileSystemManager.ListDirectoryContents(hostId, dirPath);
        for (const child of children)
        {
            const childPath = path.join(dirPath, child);
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