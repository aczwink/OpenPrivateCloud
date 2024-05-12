/**
 * OpenPrivateCloud
 * Copyright (C) 2019-2024 Amir Czwink (amir130@hotmail.de)
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
import { BaseResourceProperties, ResourceProvider } from "../resource-providers/ResourceProvider";
import { ResourceGroup } from "../data-access/ResourceGroupsController";
import { HostStoragesManager } from "./HostStoragesManager";
import { HostStorage, HostStoragesController } from "../data-access/HostStoragesController";
import { HostsController } from "../data-access/HostsController";
import { HealthStatus } from "../data-access/HealthController";
import { ResourceReference } from "../common/ResourceReference";
import { ResourceProviderManager } from "./ResourceProviderManager";
import { ResourceHealthManager } from "./ResourceHealthManager";
import { ProcessTrackerManager } from "./ProcessTrackerManager";
import { ResourceConfigController } from "../data-access/ResourceConfigController";
import { ResourcesController } from "../data-access/ResourcesController";
import { ModulesManager } from "./ModulesManager";

@Injectable
export class ResourceDeploymentService
{
    constructor(private hostStoragesManager: HostStoragesManager, private hostStoragesController: HostStoragesController, private hostsController: HostsController, private resourceProviderManager: ResourceProviderManager,
        private resourceHealthManager: ResourceHealthManager, private processTrackerManager: ProcessTrackerManager, private instanceConfigController: ResourceConfigController, private resourcesController: ResourcesController,
        private modulesManager: ModulesManager)
    {
    }

    //Public methods
    public async StartInstanceDeployment(resourceProperties: BaseResourceProperties, resourceGroup: ResourceGroup, hostId: number, userId: number)
    {
        const {resourceProvider, resourceTypeDef} = this.resourceProviderManager.FindResourceProviderByResourceProperties(resourceProperties);

        for (const moduleName of resourceTypeDef.requiredModules)
            await this.modulesManager.EnsureModuleIsInstalled(hostId, moduleName);

        const storageId = await this.hostStoragesManager.FindOptimalStorage(hostId, resourceTypeDef.fileSystemType);
        const storage = await this.hostStoragesController.RequestHostStorage(storageId);
        const host = await this.hostsController.QueryHost(storage!.hostId);

        const resourceId = await this.resourcesController.AddInstance(resourceGroup.id, storage!.id, resourceProvider.name, resourceProperties.type, resourceProperties.name);
        await this.resourceHealthManager.UpdateResourceAvailability(resourceId, HealthStatus.InDeployment);

        const ref = new ResourceReference({
            id: resourceId,
            resourceGroupName: resourceGroup.name,
            name: resourceProperties.name,
            resourceType: resourceProperties.type,
            resourceProviderName: resourceProvider.name,
            hostId,
            hostName: host!.hostName,
            hostStoragePath: storage!.path,
        });
        this.TryDeployInstance(resourceProvider, resourceProperties, ref, hostId, storage!, userId);
        return ref;
    }

    //Private methods
    private async DeployInstance(resourceProvider: ResourceProvider<any>, instanceProperties: BaseResourceProperties, instanceReference: ResourceReference, hostId: number, storage: HostStorage, userId: number)
    {
        const result = await resourceProvider.ProvideResource(instanceProperties, {
            resourceReference: instanceReference,
            hostId,
            storagePath: storage.path,
            userId,
        });

        if(result.config !== undefined)
        {
            await this.instanceConfigController.UpdateOrInsertConfig(instanceReference.id, result.config);
        }
    }
    
    private async TryDeployInstance(resourceProvider: ResourceProvider<any>, instanceProperties: BaseResourceProperties, resourceReference: ResourceReference, hostId: number, storage: HostStorage, userId: number)
    {
        const tracker = await this.processTrackerManager.Create(hostId, "Deployment of: " + resourceReference.externalId);
        try
        {
            await this.DeployInstance(resourceProvider, instanceProperties, resourceReference, hostId, storage, userId);
            tracker.Finish();

            await this.resourceHealthManager.CheckResourceAvailability(resourceReference.id);
            await this.resourceHealthManager.ScheduleResourceCheck(resourceReference.id);
        }
        catch(e)
        {
            tracker.Fail(e);

            await this.resourceHealthManager.UpdateResourceAvailability(resourceReference.id, HealthStatus.Corrupt, "Deployment failed");
        }
    }
}