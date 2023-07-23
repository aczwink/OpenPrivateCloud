/**
 * OpenPrivateCloud
 * Copyright (C) 2023 Amir Czwink (amir130@hotmail.de)
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
import { ResourcesController } from "../data-access/ResourcesController";
import { ResourcesManager } from "./ResourcesManager";
import { EnumeratorBuilder } from "acts-util-core/dist/Enumeration/EnumeratorBuilder";
import { ResourceGroupsController } from "../data-access/ResourceGroupsController";
import { ResourceProviderManager } from "./ResourceProviderManager";
  
@Injectable
export class ResourceGroupsManager
{
    constructor(private resourcesController: ResourcesController, private resourcesManager: ResourcesManager, private resourceGroupsController: ResourceGroupsController, private resourceProviderManager: ResourceProviderManager)
    {
    }

    //Public methods
    public async ChangeGroupName(groupId: number, newResourceGroupName: string)
    {
        const resourceIds = await this.resourcesController.QueryAllResourceIdsInResourceGroup(groupId);
        const oldRefs = await this.QueryResourceReferences(resourceIds);
        const oldExternalIdMap = oldRefs.ToDictionary(x => x.id, x => x.externalId);

        await this.resourceGroupsController.UpdateGroup(groupId, newResourceGroupName);

        const newRefs = await this.QueryResourceReferences(resourceIds);
        for (const newRef of newRefs)
        {
            await this.resourceProviderManager.ExternalResourceIdChanged(newRef, oldExternalIdMap[newRef.id]!);
        }
    }

    //Private methods
    private async QueryResourceReferences(resourceIds: EnumeratorBuilder<number>)
    {
        const res = await resourceIds.Map(id => this.resourcesManager.CreateResourceReference(id)).PromiseAll();
        return res.Values().NotUndefined();
    }
}