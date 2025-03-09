/**
 * OpenPrivateCloud
 * Copyright (C) 2024-2025 Amir Czwink (amir130@hotmail.de)
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
import { ResourceReference } from "../common/ResourceReference";
import { ResourceProviderManager } from "./ResourceProviderManager";
import { BaseResourceProperties } from "../resource-providers/ResourceProvider";
import { ModulesManager } from "./ModulesManager";
import { HostStoragesManager } from "./HostStoragesManager";
import { HostStoragesController } from "../data-access/HostStoragesController";
import { ResourceHealthManager } from "./ResourceHealthManager";
import { HealthStatus } from "../data-access/HealthController";
import { HostsController } from "../data-access/HostsController";
import { EqualsAny } from "acts-util-core";
import { ResourcesController } from "../data-access/ResourcesController";

@Injectable
export class ResourceRehostingService
{
    constructor(private resourceProviderManager: ResourceProviderManager, private modulesManager: ModulesManager, private hostStoragesManager: HostStoragesManager,
        private hostStoragesController: HostStoragesController, private resourceHealthManager: ResourceHealthManager, private hostsController: HostsController,
        private resourcesController: ResourcesController
    )
    {
    }

    //Public methods
    public async RehostResource(resourceReference: ResourceReference, targetProperties: BaseResourceProperties, targetHostId: number, opcUserId: number)
    {
        const {resourceProvider, resourceTypeDef} = this.resourceProviderManager.FindResourceProviderByResourceProperties(targetProperties);
        if(resourceProvider.name !== resourceReference.resourceProviderName)
            throw new Error("Resource type can't be changed");
        if(!EqualsAny(await this.resourceProviderManager.FindResourceTypeDefinition(resourceReference), resourceTypeDef))
            throw new Error("Resource type can't be changed");

        const storageId = await this.hostStoragesManager.FindOptimalStorage(targetHostId, resourceTypeDef.fileSystemType);
        const storage = await this.hostStoragesController.RequestHostStorage(storageId);
        const host = await this.hostsController.QueryHost(storage!.hostId);

        for (const moduleName of resourceTypeDef.requiredModules)
            await this.modulesManager.EnsureModuleIsInstalled(targetHostId, moduleName);

        await this.resourceHealthManager.UpdateResourceAvailability(resourceReference.id, HealthStatus.InDeployment);

        const targetResourceReference = new ResourceReference({
            id: resourceReference.id,
            resourceGroupName: resourceReference.resourceGroupName,
            name: resourceReference.name,
            resourceType: resourceReference.resourceTypeName,
            resourceProviderName: resourceProvider.name,
            hostId: targetHostId,
            hostName: host!.hostName,
            hostStoragePath: storage!.path,
        });

        await resourceProvider.RehostResource(resourceReference, targetProperties, {
            resourceReference: targetResourceReference,
            hostId: targetHostId,
            storagePath: storage!.path,
            opcUserId: opcUserId,
        });

        await this.resourcesController.UpdateResourceStorage(resourceReference.id, storageId);

        await this.resourceHealthManager.CheckResourceAvailability(resourceReference.id);
    }
}