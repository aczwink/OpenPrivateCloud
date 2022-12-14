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
import { InstanceConfigController } from "../data-access/InstanceConfigController";
import { HostStorage, HostStoragesController } from "../data-access/HostStoragesController";
import { InstancesController } from "../data-access/InstancesController";
import { BaseResourceProperties, ResourceProvider, ResourceTypeDefinition } from "../resource-providers/ResourceProvider";
import { APISchemaService } from "./APISchemaService";
import { HostStoragesManager } from "./HostStoragesManager";
import { InstancesManager } from "./InstancesManager";
import { PermissionsManager } from "./PermissionsManager";
import { InstanceLogsController } from "../data-access/InstanceLogsController";
import { ProcessTrackerManager } from "./ProcessTrackerManager";
import { HealthController, HealthStatus } from "../data-access/HealthController";
import { RoleAssignmentsController } from "../data-access/RoleAssignmentsController";

@Injectable
export class ResourceProviderManager
{
    constructor(private apiSchemaService: APISchemaService, private instancesController: InstancesController, private hostStoragesManager: HostStoragesManager,
        private instancesManager: InstancesManager, private hostStoragesController: HostStoragesController, private permissionsManager: PermissionsManager,
        private instanceConfigController: InstanceConfigController, private instanceLogsController: InstanceLogsController,
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

        const instance = await this.instancesController.QueryInstance(fullInstanceName);
        const storage = await this.hostStoragesController.RequestHostStorage(instance!.storageId);

        await resourceProvider.CheckInstanceAvailability(storage!.hostId, fullInstanceName);
    }

    public async CheckInstanceHealth(fullInstanceName: string)
    {
        const resourceProvider = this.FindInstanceProviderFromFullInstanceName(fullInstanceName);

        const instance = await this.instancesController.QueryInstance(fullInstanceName);
        const storage = await this.hostStoragesController.RequestHostStorage(instance!.storageId);

        await resourceProvider.CheckInstanceHealth(storage!.hostId, fullInstanceName);
    }

    public async DeleteInstance(fullInstanceName: string)
    {
        const resourceProvider = this.FindInstanceProviderFromFullInstanceName(fullInstanceName);
        const instanceContext = await this.instancesManager.CreateInstanceContext(fullInstanceName);
        if(instanceContext === undefined)
            return null;

        const instanceId = instanceContext.instanceId;

        //first everything that the user is also able to do himself
        const roleAssignments = await this.roleAssignmentsController.QueryInstanceRoleAssignments(fullInstanceName);
        for (const roleAssignment of roleAssignments)
            await this.permissionsManager.DeleteInstanceRoleAssignment(instanceId, roleAssignment);

        //delete the resource
        const result = await resourceProvider.DeleteResource(instanceContext);
        if(result !== null)
            return result;

        //the resource is now degraded and should not be queried anymore. simply clean up
        await this.instanceConfigController.DeleteConfig(instanceId);
        await this.healthController.DeleteInstanceHealthData(instanceId);
        await this.instanceLogsController.DeleteLogsAssociatedWithInstance(instanceId);

        await this.instancesController.DeleteInstance(fullInstanceName);
        
        return null;
    }

    public async StartInstanceDeployment(instanceProperties: BaseResourceProperties, hostId: number, userId: number)
    {
        const {resourceProvider, resourceTypeDef} = this._resourceProviders.Values()
            .Map(this.MatchPropertiesWithResourceProviderResourceTypes.bind(this, instanceProperties)).NotUndefined().First();

        const fullInstanceName = this.instancesManager.CreateUniqueInstanceName(resourceProvider.name, instanceProperties.type, instanceProperties.name);

        const storageId = await this.hostStoragesManager.FindOptimalStorage(hostId, resourceTypeDef.fileSystemType);
        const storage = await this.hostStoragesController.RequestHostStorage(storageId);
        this.TryDeployInstance(resourceProvider, instanceProperties, fullInstanceName, hostId, storage!, userId);
    }

    public async InstancePermissionsChanged(fullInstanceName: string)
    {
        const resourceProvider = this.FindInstanceProviderFromFullInstanceName(fullInstanceName);
        const instanceContext = await this.instancesManager.CreateInstanceContext(fullInstanceName);

        if(instanceContext !== undefined)
            await resourceProvider.InstancePermissionsChanged(instanceContext);
    }

    public Register(resourceProviderClass: Instantiatable<ResourceProvider<any>>)
    {
        this._resourceProviders.push(GlobalInjector.Resolve(resourceProviderClass));
    }

    public RetrieveInstanceCheckSchedule(fullInstanceName: string)
    {
        const parts = this.instancesManager.ExtractPartsFromFullInstanceName(fullInstanceName);

        const resourceProvider = this.FindInstanceProviderFromFullInstanceName(fullInstanceName);
        const resourceType = resourceProvider.resourceTypeDefinitions.find(x => this.ExtractTypeNameFromResourceTypeDefinition(x) === parts.resourceTypeName);
        return resourceType!.healthCheckSchedule;
    }

    //Private variables
    private _resourceProviders: ResourceProvider<any>[];

    //Private methods
    private async DeployInstance(resourceProvider: ResourceProvider<any>, instanceProperties: BaseResourceProperties, fullInstanceName: string, hostId: number, storage: HostStorage, userId: number)
    {
        const result = await resourceProvider.ProvideResource(instanceProperties, {
            fullInstanceName,
            hostId,
            storagePath: storage.path,
            userId
        });

        const instanceId = await this.instancesController.AddInstance(storage.id, fullInstanceName);
        if(result.config !== undefined)
        {
            await this.instanceConfigController.UpdateOrInsertConfig(instanceId, result.config);
        }
        await this.healthController.UpdateInstanceAvailability(instanceId, HealthStatus.Up);
    }

    private ExtractTypeNameFromResourceTypeDefinition(resourceTypeDef: ResourceTypeDefinition): string
    {
        return this.apiSchemaService.CreateDefault(this.apiSchemaService.GetSchema(resourceTypeDef.schemaName)).type;
    }

    private FindInstanceProviderFromFullInstanceName(fullInstanceName: string)
    {
        const parts = this.instancesManager.ExtractPartsFromFullInstanceName(fullInstanceName);
        const resourceProvider = this.resourceProviders.Values().Filter(x => x.name === parts.resourceProviderName).First();

        return resourceProvider;
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

    private async TryDeployInstance(resourceProvider: ResourceProvider<any>, instanceProperties: BaseResourceProperties, fullInstanceName: string, hostId: number, storage: HostStorage, userId: number)
    {
        const tracker = await this.processTrackerManager.Create(hostId, "Deployment of: " + fullInstanceName);
        try
        {
            await this.DeployInstance(resourceProvider, instanceProperties, fullInstanceName, hostId, storage, userId);
            tracker.Finish();
        }
        catch(e)
        {
            tracker.Fail(e);
        }
    }
}