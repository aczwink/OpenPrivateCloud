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
import { InstanceConfigController } from "../data-access/InstanceConfigController";
import { HostStorage, HostStoragesController } from "../data-access/HostStoragesController";
import { ResourcesController } from "../data-access/ResourcesController";
import { BaseResourceProperties, ResourceProvider, ResourceTypeDefinition } from "../resource-providers/ResourceProvider";
import { APISchemaService } from "./APISchemaService";
import { HostStoragesManager } from "./HostStoragesManager";
import { ResourcesManager } from "./ResourcesManager";
import { PermissionsManager } from "./PermissionsManager";
import { InstanceLogsController } from "../data-access/InstanceLogsController";
import { ProcessTrackerManager } from "./ProcessTrackerManager";
import { HealthController, HealthStatus } from "../data-access/HealthController";
import { RoleAssignmentsController } from "../data-access/RoleAssignmentsController";
import { ResourceGroup } from "../data-access/ResourceGroupsController";
import { ResourceReference } from "../common/InstanceReference";
import { HostsController } from "../data-access/HostsController";

@Injectable
export class ResourceProviderManager
{
    constructor(private apiSchemaService: APISchemaService, private instancesController: ResourcesController, private hostStoragesManager: HostStoragesManager,
        private instancesManager: ResourcesManager, private hostStoragesController: HostStoragesController, private permissionsManager: PermissionsManager,
        private instanceConfigController: InstanceConfigController, private instanceLogsController: InstanceLogsController, private hostsController: HostsController,
        private processTrackerManager: ProcessTrackerManager, private healthController: HealthController, private roleAssignmentsController: RoleAssignmentsController)
    {
        this._resourceProviders = [];
    }

    //Properties
    public get resourceProviders()
    {
        return this._resourceProviders;
    }

    //Public methods
    public async CheckInstanceAvailability(fullInstanceName: string)
    {
        const resourceProvider = this.FindInstanceProviderFromFullInstanceName(fullInstanceName);
        const instanceContext = await this.instancesManager.TODO_LEGACYCreateInstanceContext(fullInstanceName);

        await resourceProvider.CheckInstanceAvailability(instanceContext!);
    }

    public async CheckInstanceHealth(fullInstanceName: string)
    {
        const resourceProvider = this.FindInstanceProviderFromFullInstanceName(fullInstanceName);
        const instanceContext = await this.instancesManager.TODO_LEGACYCreateInstanceContext(fullInstanceName);

        await resourceProvider.CheckInstanceHealth(instanceContext!);
    }

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

        await this.instancesController.DeleteResource(resourceReference.id);
        
        return null;
    }

    public async StartInstanceDeployment(instanceProperties: BaseResourceProperties, instanceGroup: ResourceGroup, hostId: number, userId: number)
    {
        const {resourceProvider, resourceTypeDef} = this._resourceProviders.Values()
            .Map(this.MatchPropertiesWithResourceProviderResourceTypes.bind(this, instanceProperties)).NotUndefined().First();

        const storageId = await this.hostStoragesManager.FindOptimalStorage(hostId, resourceTypeDef.fileSystemType);
        const storage = await this.hostStoragesController.RequestHostStorage(storageId);
        const host = await this.hostsController.QueryHost(storage!.hostId);

        const instanceId = await this.instancesController.AddInstance(instanceGroup.id, storage!.id, resourceProvider.name, instanceProperties.type, instanceProperties.name);
        await this.healthController.UpdateInstanceAvailability(instanceId, HealthStatus.InDeployment);

        const instanceReference = new ResourceReference({
            id: instanceId,
            resourceGroupName: instanceGroup.name,
            name: instanceProperties.name,
            resourceType: instanceProperties.type,
            resourceProviderName: resourceProvider.name,
            hostId,
            hostName: host!.hostName,
            hostStoragePath: storage!.path,
        });
        this.TryDeployInstance(resourceProvider, instanceProperties, instanceReference, hostId, storage!, userId);
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
        const resource = await this.instancesController.QueryResource(instanceId);

        const resourceProvider = this.FindResourceProviderByName(resource!.resourceProviderName);
        const resourceType = resourceProvider.resourceTypeDefinitions.find(x => this.ExtractTypeNameFromResourceTypeDefinition(x) === resource!.instanceType);
        return resourceType!.healthCheckSchedule;
    }

    //Private variables
    private _resourceProviders: ResourceProvider<any>[];

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

    private ExtractTypeNameFromResourceTypeDefinition(resourceTypeDef: ResourceTypeDefinition): string
    {
        return this.apiSchemaService.CreateDefault(this.apiSchemaService.GetSchema(resourceTypeDef.schemaName)).type;
    }

    private FindInstanceProviderFromFullInstanceName(fullInstanceName: string)
    {
        const parts = this.instancesManager.TODO_DEPRECATED_ExtractPartsFromFullInstanceName(fullInstanceName);
        return this.FindResourceProviderByName(parts.resourceProviderName);
    }

    private FindResourceProviderByName(name: string)
    {
        return this.resourceProviders.Values().Filter(x => x.name === name).First();;
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

    private async TryDeployInstance(resourceProvider: ResourceProvider<any>, instanceProperties: BaseResourceProperties, instanceReference: ResourceReference, hostId: number, storage: HostStorage, userId: number)
    {
        const tracker = await this.processTrackerManager.Create(hostId, "Deployment of: " + instanceReference.externalId);
        try
        {
            await this.DeployInstance(resourceProvider, instanceProperties, instanceReference, hostId, storage, userId);
            tracker.Finish();

            await this.healthController.UpdateInstanceAvailability(instanceReference.id, HealthStatus.Up);
        }
        catch(e)
        {
            tracker.Fail(e);

            await this.healthController.UpdateInstanceAvailability(instanceReference.id, HealthStatus.Corrupt);
        }
    }
}