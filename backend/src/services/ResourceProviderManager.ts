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

import { Instantiatable } from "acts-util-core";
import { GlobalInjector, Injectable } from "acts-util-node";
import { ResourceConfigController } from "../data-access/ResourceConfigController";
import { ResourcesController } from "../data-access/ResourcesController";
import { BaseResourceProperties, ResourceProvider, ResourceTypeDefinition } from "../resource-providers/ResourceProvider";
import { APISchemaService } from "./APISchemaService";
import { PermissionsManager } from "./PermissionsManager";
import { ResourceLogsController } from "../data-access/ResourceLogsController";
import { HealthController } from "../data-access/HealthController";
import { RoleAssignmentsController } from "../data-access/RoleAssignmentsController";
import { ResourceReference } from "../common/ResourceReference";

@Injectable
export class ResourceProviderManager
{
    constructor(private apiSchemaService: APISchemaService, private resourcesController: ResourcesController, private permissionsManager: PermissionsManager,
        private instanceConfigController: ResourceConfigController, private instanceLogsController: ResourceLogsController, private healthController: HealthController, private roleAssignmentsController: RoleAssignmentsController)
    {
        this._resourceProviders = [];
    }

    //Properties
    public get resourceProviders()
    {
        return this._resourceProviders;
    }

    //Public methods
    public async DeleteResource(resourceReference: ResourceReference)
    {
        const resourceProvider = this.FindResourceProviderByName(resourceReference.resourceProviderName);
        const resourceId = resourceReference.id;

        //first everything that the user is also able to do himself
        const roleAssignments = await this.roleAssignmentsController.QueryResourceLevelRoleAssignments(resourceReference.id);
        for (const roleAssignment of roleAssignments)
            await this.permissionsManager.DeleteInstanceRoleAssignment(resourceId, roleAssignment);

        //delete the resource
        const result = await resourceProvider.DeleteResource(resourceReference);
        if(result !== null)
            return result;

        //the resource is now degraded and should not be queried anymore. simply clean up
        await this.instanceConfigController.DeleteConfig(resourceId);
        await this.healthController.DeleteInstanceHealthData(resourceId);
        await this.instanceLogsController.DeleteLogsAssociatedWithInstance(resourceId);

        await this.resourcesController.DeleteResource(resourceReference.id);
        
        return null;
    }

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

    public async InstancePermissionsChanged(resourceReference: ResourceReference)
    {
        const resourceProvider = this.FindResourceProviderByName(resourceReference.resourceProviderName);
        await resourceProvider.InstancePermissionsChanged(resourceReference);
    }

    public Register(resourceProviderClass: Instantiatable<ResourceProvider<any>>)
    {
        this._resourceProviders.push(GlobalInjector.Resolve(resourceProviderClass));
    }

    public async RetrieveInstanceCheckSchedule(instanceId: number)
    {
        const resource = await this.resourcesController.QueryResource(instanceId);

        const resourceProvider = this.FindResourceProviderByName(resource!.resourceProviderName);
        const resourceType = resourceProvider.resourceTypeDefinitions.find(x => this.ExtractTypeNameFromResourceTypeDefinition(x) === resource!.instanceType);
        return resourceType!.healthCheckSchedule;
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