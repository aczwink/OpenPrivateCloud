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

import { Instantiatable } from "acts-util-core";
import { GlobalInjector, Injectable } from "acts-util-node";
import { HostStoragesController } from "../data-access/HostStoragesController";
import { InstancesController } from "../data-access/InstancesController";
import { BaseResourceProperties, DeploymentContext, ResourceProvider } from "../resource-providers/ResourceProvider";
import { APISchemaService } from "./APISchemaService";
import { HostStoragesManager } from "./HostStoragesManager";
import { InstancesManager } from "./InstancesManager";

@Injectable
export class ResourceProviderManager
{
    constructor(private apiSchemaService: APISchemaService, private instancesController: InstancesController, private hostStoragesManager: HostStoragesManager,
        private instancesManager: InstancesManager, private hostStoragesController: HostStoragesController)
    {
        this._resourceProviders = [];
    }

    //Properties
    public get resourceProviders()
    {
        return this._resourceProviders;
    }

    //Public methods
    public async DeleteInstance(fullInstanceName: string)
    {
        const parts = this.instancesManager.ExtractPartsFromFullInstanceName(fullInstanceName);
        const resourceProvider = this.resourceProviders.Values().Filter(x => x.name === parts.resourceProviderName).First();

        const instance = await this.instancesController.QueryInstance(fullInstanceName);
        const storage = await this.hostStoragesController.RequestHostStorage(instance!.storageId);

        await resourceProvider.DeleteResource(storage!.hostId, storage!.path, fullInstanceName);

        await this.instancesController.DeleteInstance(fullInstanceName);
    }

    public async DeployInstance(instanceProperties: BaseResourceProperties, hostId: number, userId: number)
    {
        const {resourceProvider, resourceTypeDef} = this._resourceProviders.Values()
            .Map(this.MatchPropertiesWithResourceProviderResourceTypes.bind(this, instanceProperties)).NotUndefined().First();

        const fullInstanceName = this.instancesManager.CreateUniqueInstanceName(resourceProvider.name, instanceProperties.type, instanceProperties.name);

        const storageId = await this.hostStoragesManager.FindOptimalStorage(hostId, resourceTypeDef.fileSystemType);
        const storage = await this.hostStoragesController.RequestHostStorage(storageId);
        await resourceProvider.ProvideResource(instanceProperties, {
            fullInstanceName,
            hostId,
            storagePath: storage!.path,
            userId
        });

        await this.instancesController.AddInstance(storageId, fullInstanceName);
    }

    public Register(resourceProviderClass: Instantiatable<ResourceProvider<any>>)
    {
        this._resourceProviders.push(GlobalInjector.Resolve(resourceProviderClass));
    }

    //Private variables
    private _resourceProviders: ResourceProvider<any>[];

    //Private methods
    private MatchPropertiesWithResourceProviderResourceTypes(instanceProperties: BaseResourceProperties, resourceProvider: ResourceProvider<any>)
    {
        const result = resourceProvider.resourceTypeDefinitions.Values().Filter(def => this.apiSchemaService.Validate(instanceProperties, def.schemaName)).FirstOrUndefined();
        if(result === undefined)
            return undefined;
        return {
            resourceProvider,
            resourceTypeDef: result
        };
    }
}