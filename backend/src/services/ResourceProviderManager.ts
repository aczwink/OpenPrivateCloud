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

import { Instantiatable } from "acts-util-core";
import { GlobalInjector, Injectable } from "acts-util-node";
import { BaseResourceProperties, ResourceProvider, ResourceStateResult, ResourceTypeDefinition } from "../resource-providers/ResourceProvider";
import { APISchemaService } from "./APISchemaService";
import { ResourceReference } from "../common/ResourceReference";
import { ErrorService } from "./ErrorService";

@Injectable
export class ResourceProviderManager
{
    constructor(private apiSchemaService: APISchemaService, private errorService: ErrorService)
    {
        this._resourceProviders = [];
    }

    //Properties
    public get resourceProviders()
    {
        return this._resourceProviders;
    }

    //Public methods
    public async ExternalResourceIdChanged(resourceReference: ResourceReference, oldExternalResourceId: string)
    {
        const resourceProvider = this.FindResourceProviderByName(resourceReference.resourceProviderName);
        await resourceProvider.ExternalResourceIdChanged(resourceReference, oldExternalResourceId);
    }

    public FindResourceProviderByResource(resourceReference: ResourceReference)
    {
        return this.FindResourceProviderByName(resourceReference.resourceProviderName);
    }

    public FindResourceProviderByResourceProperties(resourceProperties: BaseResourceProperties)
    {
        const {resourceProvider, resourceTypeDef} = this._resourceProviders.Values()
            .Map(this.MatchPropertiesWithResourceProviderResourceTypes.bind(this, resourceProperties)).NotUndefined().First();
        return { resourceProvider, resourceTypeDef };
    }

    public async FindResourceTypeDefinition(resourceReference: ResourceReference)
    {
        const resourceProvider = this.FindResourceProviderByName(resourceReference.resourceProviderName);
        const resourceType = resourceProvider.resourceTypeDefinitions.find(x => this.ExtractTypeNameFromResourceTypeDefinition(x) === resourceReference.resourceTypeName);
        return resourceType;
    }

    public async ResourcePermissionsChanged(resourceReference: ResourceReference)
    {
        const resourceProvider = this.FindResourceProviderByName(resourceReference.resourceProviderName);
        await resourceProvider.ResourcePermissionsChanged(resourceReference);
    }

    public async QueryResourceState(resourceReference: ResourceReference): Promise<ResourceStateResult>
    {
        const resourceProvider = this.FindResourceProviderByResource(resourceReference);
        try
        {
            return await resourceProvider.QueryResourceState(resourceReference);
        }
        catch(e)
        {
            return {
                state: "down",
                context: this.errorService.ExtractDataAsMultipleLines(e),
            };
        }
    }

    public Register(resourceProviderClass: Instantiatable<ResourceProvider<any>>)
    {
        this._resourceProviders.push(GlobalInjector.Resolve(resourceProviderClass));
    }

    public async RequestDataProvider(resourceReference: ResourceReference)
    {
        const rp = this.FindResourceProviderByResource(resourceReference);
        return await rp.RequestDataProvider(resourceReference);
    }

    public async RetrieveInstanceCheckSchedule(resourceReference: ResourceReference)
    {
        const resourceTypeDef = await this.FindResourceTypeDefinition(resourceReference);
        return resourceTypeDef!.healthCheckSchedule;
    }

    //Private variables
    private _resourceProviders: ResourceProvider<any>[];

    //Private methods
    private ExtractTypeNameFromResourceTypeDefinition(resourceTypeDef: ResourceTypeDefinition): string
    {
        return this.apiSchemaService.CreateDefault(this.apiSchemaService.GetSchema(resourceTypeDef.schemaName)).type;
    }

    private FindResourceProviderByName(name: string)
    {
        return this._resourceProviders.Values().Filter(x => x.name === name).First();
    }

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