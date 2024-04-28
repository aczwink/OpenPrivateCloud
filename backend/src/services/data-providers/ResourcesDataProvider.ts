/**
 * OpenPrivateCloud
 * Copyright (C) 2024 Amir Czwink (amir130@hotmail.de)
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

import { GlobalInjector, Injectable } from "acts-util-node";
import { DataSourceCollectionProvider, DataSourcesProvider } from "../ClusterDataProvider";
import { Dictionary } from "acts-util-core";
import { ResourceGroupsController } from "../../data-access/ResourceGroupsController";
import { ResourcesController } from "../../data-access/ResourcesController";
import { ResourcesManager } from "../ResourcesManager";
import { ResourceProviderManager } from "../ResourceProviderManager";

export class ResourceGroupDataProvider implements DataSourceCollectionProvider
{
    constructor(private resourceGroupId: number)
    {
    }

    public async QueryChildren(): Promise<Dictionary<DataSourcesProvider>>
    {
        const resourcesController = GlobalInjector.Resolve(ResourcesController);
        const resourcesManager = GlobalInjector.Resolve(ResourcesManager);
        const resourceProviderManager = GlobalInjector.Resolve(ResourceProviderManager);

        const ids = await resourcesController.QueryAllResourceIdsInResourceGroup(this.resourceGroupId);
        const resourceDataProviders = await ids.Map(async x => {
            const ref = await resourcesManager.CreateResourceReference(x);
            if(ref === undefined)
                return undefined;
            const dataProvider = await resourceProviderManager.RequestDataProvider(ref);
            if(dataProvider === null)
                return undefined;

            return {
                key: ref.externalId,
                value: dataProvider
            };
        }).PromiseAll();

        return resourceDataProviders.Values().NotUndefined().ToDictionary(kv => kv.key, kv => kv.value);
    }
}

@Injectable
export class ResourceGroupsDataProvider implements DataSourceCollectionProvider
{
    constructor(private resourceGroupsController: ResourceGroupsController)
    {
    }

    public async QueryChildren(): Promise<Dictionary<DataSourcesProvider>>
    {
        const groups = await this.resourceGroupsController.QueryAllGroups();

        return groups.Values().ToDictionary(x => x.name, x => new ResourceGroupDataProvider(x.id));
    }
}