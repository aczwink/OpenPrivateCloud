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
import { resourceProviders } from "openprivatecloud-common";
import { DeploymentContext, DeploymentResult, ResourceDeletionError, ResourceProvider, ResourceStateResult, ResourceTypeDefinition } from "../ResourceProvider";
import { ResourceReference } from "../../common/ResourceReference";
import { IntegrationServicesProperties } from "./properties";
import { ManagedActiveDirectoryManager } from "./ManagedActiveDirectoryManager";
 
@Injectable
export class IntegrationServicesResourceProvider implements ResourceProvider<IntegrationServicesProperties>
{
    constructor(private activeDirectoryDomainControllerManager: ManagedActiveDirectoryManager)
    {
    }

    //Properties
    public get name(): string
    {
        return resourceProviders.integrationServices.name;
    }

    public get resourceTypeDefinitions(): ResourceTypeDefinition[]
    {
        return [
            {
                fileSystemType: "ext4", //the whole purpose of this service is to have the domain fully managed, i.e. data files can be regenerated any time by the service. To reduce disk IO for samba databases ext4 is preferred here
                healthCheckSchedule: null,
                schemaName: "ManagedActiveDirectoryProperties"
            },
        ];
    }

    //Public methods
    public async CheckResourceHealth(resourceReference: ResourceReference): Promise<void>
    {
    }
    
    public async DeleteResource(resourceReference: ResourceReference): Promise<ResourceDeletionError | null>
    {
        switch(resourceReference.resourceTypeName)
        {
            case resourceProviders.integrationServices.managedActiveDirectoryResourceType.name:
                await this.activeDirectoryDomainControllerManager.DeleteResource(resourceReference);
                break;
        }

        return null;
    }

    public async ExternalResourceIdChanged(resourceReference: ResourceReference, oldExternalResourceId: string): Promise<void>
    {
    }

    public async InstancePermissionsChanged(resourceReference: ResourceReference): Promise<void>
    {
        switch(resourceReference.resourceTypeName)
        {
            case resourceProviders.integrationServices.managedActiveDirectoryResourceType.name:
                await this.activeDirectoryDomainControllerManager.ResourcePermissionsChanged(resourceReference);
                break;
        }
    }

    public async ProvideResource(instanceProperties: IntegrationServicesProperties, context: DeploymentContext): Promise<DeploymentResult>
    {
        switch(instanceProperties.type)
        {
            case "managed-ad":
                await this.activeDirectoryDomainControllerManager.ProvideResource(instanceProperties, context);
                return {};
        }
    }

    public async QueryResourceState(resourceReference: ResourceReference): Promise<ResourceStateResult>
    {
        switch(resourceReference.resourceTypeName)
        {
            case resourceProviders.integrationServices.managedActiveDirectoryResourceType.name:
                return await this.activeDirectoryDomainControllerManager.QueryResourceState(resourceReference);
        }
        return "corrupt";
    }
}