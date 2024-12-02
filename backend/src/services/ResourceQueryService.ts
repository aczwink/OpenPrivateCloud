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

import { EnumeratorBuilder } from "acts-util-core/dist/Enumeration/EnumeratorBuilder";
import { Injectable } from "acts-util-node";
import { ResourceState } from "../resource-providers/ResourceProvider";
import { ResourcesController } from "../data-access/ResourcesController";
import { ResourcesManager } from "./ResourcesManager";
import { PermissionsManager } from "./PermissionsManager";
import { permissions } from "openprivatecloud-common";
import { ResourceGroupsController } from "../data-access/ResourceGroupsController";
import { PermissionsController } from "../data-access/PermissionsController";
import { ResourceHealthManager } from "./ResourceHealthManager";
import { ResourceReference } from "../common/ResourceReference";
import { HealthStatus } from "../data-access/HealthController";
import { ResourceProviderManager } from "./ResourceProviderManager";
import { HostsController } from "../data-access/HostsController";

interface ResourceOverviewDataDTO
{
    id: string;
    name: string;
    resourceGroupName: string;
    resourceProviderName: string;
    instanceType: string;
    healthStatus: HealthStatus;
    state: ResourceState;
}

@Injectable
export class ResourceQueryService
{
    constructor(private resourcesController: ResourcesController, private resourcesManager: ResourcesManager, private resourceHealthManager: ResourceHealthManager, private permissionsManager: PermissionsManager, 
        private resourceGroupsController: ResourceGroupsController, private permissionsController: PermissionsController, private resourceProviderManager: ResourceProviderManager,
        private hostsController: HostsController)
    {
    }
    
    //Public methods
    public async QueryHostResourceIds(hostName: string)
    {
        const hostId = await this.hostsController.RequestHostId(hostName);
        if(hostId === undefined)
            return undefined;

        const resourceIds = await this.resourcesController.QueryResourceIdsAssociatedWithHost(hostId);
        return resourceIds;
    }

    public async QueryResourceIds(userId: number)
    {
        const cluster = await this.permissionsManager.HasUserClusterWidePermission(userId, permissions.read);
        const rgIds = cluster ? (await this.resourceGroupsController.QueryAllGroups()).Values().Map(x => x.id) : await this.permissionsController.QueryResourceGroupIdsThatUserHasAccessTo(userId);
        const resourceIdSets = await this.QueryResourceIdsOfResourceGroups(userId, rgIds);
        const resourceIds = resourceIdSets.Values().Reduce( (x, y) => x.Union(y), new Set<number>());

        const directResourceIds = await this.permissionsController.QueryResourceIdsThatUserHasDirectlyAccessTo(userId);

        return resourceIds.Union(directResourceIds.ToSet()).Values();
    }

    public async QueryOverviewData(resourceIds: EnumeratorBuilder<number>)
    {
        const instances = await resourceIds.Map(async resourceId => {
            const row = await this.resourcesController.QueryOverviewInstanceData(resourceId);
            const ref = await this.resourcesManager.CreateResourceReference(resourceId);

            const res: ResourceOverviewDataDTO = {
                id: ref!.externalId,
                instanceType: row!.instanceType,
                name: row!.name,
                resourceGroupName: row!.resourceGroupName,
                resourceProviderName: row!.resourceProviderName,
                ...await this.RequestResourceState(ref!)
            };
            return res;
        }).PromiseAll();
        return instances.Values().ToArray();
    }

    //Private methods
    private async QueryResourceIdsOfResourceGroups(userId: number, resourceGroupIds: EnumeratorBuilder<number>)
    {
        return await resourceGroupIds.Map(resourceGroupId => this.permissionsController.QueryResourceIdsOfResourcesInResourceGroupThatUserHasAccessTo(userId, resourceGroupId)).MapAsync(x => x.ToSet()).PromiseAll();
    }

    public async RequestResourceState(resourceReference: ResourceReference): Promise<{ healthStatus: HealthStatus; state: ResourceState; }>
    {
        const healthStatus = await this.resourceHealthManager.RequestHealthStatus(resourceReference.id);
        switch(healthStatus!)
        {
            case HealthStatus.Corrupt:
            case HealthStatus.Down:
            case HealthStatus.InDeployment:
                return {
                    healthStatus,
                    state: ResourceState.Stopped
                };
            case HealthStatus.Up:
            {
                const result = await this.resourceProviderManager.QueryResourceState(resourceReference!);

                if(typeof result === "number")
                {
                    return {
                        healthStatus,
                        state: result
                    };
                }

                return {
                    healthStatus: HealthStatus.Corrupt,
                    state: ResourceState.Stopped
                };
            }
        }
    }
}