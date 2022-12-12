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
import { UsersController } from "../../data-access/UsersController";
import { HostUsersManager } from "../../services/HostUsersManager";
import { InstancesManager } from "../../services/InstancesManager";
import { ModulesManager } from "../../services/ModulesManager";
import { RemoteRootFileSystemManager } from "../../services/RemoteRootFileSystemManager";
import { SystemServicesManager } from "../../services/SystemServicesManager";
import { DeploymentContext } from "../ResourceProvider";
import { ApacheManager } from "./ApacheManager";
import { StaticWebsiteProperties } from "./Properties";
import { VirtualHost } from "./VirtualHost";

@Injectable
export class StaticWebsitesManager
{
    constructor(private modulesManager: ModulesManager, private instancesManager: InstancesManager,
        private hostUsersManager: HostUsersManager, private apacheManager: ApacheManager, private usersController: UsersController,
        private systemServicesManager: SystemServicesManager, private remoteRootFileSystemManager: RemoteRootFileSystemManager)
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
            }
        ];

        const siteName = this.instancesManager.DeriveInstanceFileNameFromUniqueInstanceName(context.fullInstanceName);
        await this.apacheManager.CreateSite(context.hostId, siteName, vHost);
        await this.apacheManager.EnableSite(context.hostId, siteName);
        await this.apacheManager.EnablePort(context.hostId, instanceProperties.port);
        await this.systemServicesManager.RestartService(context.hostId, "apache2");
    }

    public UpdateContent(instanceId: number, buffer: Buffer)
    {
        console.log(instanceId, buffer);
        throw new Error("Method not implemented.");
    }
}