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
import { HostStoragesController } from "../../data-access/HostStoragesController";
import { InstancesController } from "../../data-access/InstancesController";
import { InstancesManager } from "../../services/InstancesManager";
import { ModulesManager } from "../../services/ModulesManager";
import { RemoteFileSystemManager } from "../../services/RemoteFileSystemManager";
import { DeploymentContext } from "../ResourceProvider";
import { NodeAppServiceProperties } from "./Properties";
import { SystemServicesManager } from "../../services/SystemServicesManager";
import { opcSpecialGroups, opcSpecialUsers } from "../../common/UserAndGroupDefinitions";

@Injectable
export class NodeAppServiceManager
{
    constructor(private instancesManager: InstancesManager, private modulesManager: ModulesManager, private instancesController: InstancesController,
        private hostStoragesController: HostStoragesController, private remoteFileSystemManager: RemoteFileSystemManager,
        private systemServicesManager: SystemServicesManager)
    {
    }

    //Public methods
    public async DeleteResource(hostId: number, hostStoragePath: string, fullInstanceName: string)
    {
        await this.systemServicesManager.DeleteService(hostId, this.MapFullInstanceNameToSystemDName(fullInstanceName));
        await this.instancesManager.RemoveInstanceStorageDirectory(hostId, hostStoragePath, fullInstanceName);
    }

    public async ExecuteAction(hostId: number, fullInstanceName: string, action: "start" | "stop")
    {
        const serviceName = this.MapFullInstanceNameToSystemDName(fullInstanceName);
        switch(action)
        {
            case "start":
                await this.systemServicesManager.StartService(hostId, serviceName);
                break;
            case "stop":
                await this.systemServicesManager.StopService(hostId, serviceName);
                break;
        }
    }

    public async IsAppServiceRunning(hostId: number, fullInstanceName: string)
    {
        return await this.systemServicesManager.IsServiceActive(hostId, this.MapFullInstanceNameToSystemDName(fullInstanceName));
    }

    public async ProvideResource(instanceProperties: NodeAppServiceProperties, context: DeploymentContext)
    {
        await this.modulesManager.EnsureModuleIsInstalled(context.hostId, "node");

        const instancesDir = await this.instancesManager.CreateInstanceStorageDirectory(context.hostId, context.storagePath, context.fullInstanceName);

        await this.systemServicesManager.CreateService(context.hostId, {
            command: "node " + path.join(instancesDir, "index.js"),
            environment: {},
            groupName: opcSpecialGroups.host,
            name: this.MapFullInstanceNameToSystemDName(context.fullInstanceName),
            userName: opcSpecialUsers.host
        });
    }

    public async QueryStatus(hostId: number, fullInstanceName: string)
    {
        const serviceName = this.MapFullInstanceNameToSystemDName(fullInstanceName);
        return await this.systemServicesManager.QueryStatus(hostId, serviceName);
    }

    public async UpdateContent(instanceId: number, buffer: Buffer)
    {
        const instance = await this.instancesController.QueryInstanceById(instanceId);
        const storage = await this.hostStoragesController.RequestHostStorage(instance!.storageId);

        const instancesDir = this.instancesManager.BuildInstanceStoragePath(storage!.path, instance!.fullName);

        await this.remoteFileSystemManager.WriteFile(storage!.hostId, path.join(instancesDir, "index.js"), buffer);
    }

    //Private methods
    private MapFullInstanceNameToSystemDName(fullInstanceName: string)
    {
        return this.instancesManager.DeriveInstanceFileNameFromUniqueInstanceName(fullInstanceName);
    }
}