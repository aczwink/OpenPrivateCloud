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
import { Injectable } from "acts-util-node";
import { DeploymentContext, DeploymentResult, ResourceDeletionError, ResourceProvider, ResourceStateResult, ResourceTypeDefinition } from "../ResourceProvider";
import { resourceProviders } from "openprivatecloud-common";
import { FileStoragesManager } from "./FileStoragesManager";
import { ResourceReference } from "../../common/ResourceReference";
import { FileServicesProperties } from "./properties";
import { ObjectStoragesManager } from "./ObjectStoragesManager";

@Injectable
export class FileServicesResourceProvider implements ResourceProvider<FileServicesProperties>
{
    constructor(private fileStoragesManager: FileStoragesManager, private objectStoragesManager: ObjectStoragesManager)
    {
    }
    
    //Properties
    public get name(): string
    {
        return resourceProviders.fileServices.name;
    }

    public get resourceTypeDefinitions(): ResourceTypeDefinition[]
    {
        return [
            {
                healthCheckSchedule: null,
                fileSystemType: "btrfs",
                schemaName: "FileStorageProperties"
            },
            {
                healthCheckSchedule: null,
                fileSystemType: "btrfs",
                schemaName: "ObjectStorageProperties"
            }
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
            case resourceProviders.fileServices.fileStorageResourceType.name:
                return await this.fileStoragesManager.DeleteResource(resourceReference);
            case resourceProviders.fileServices.objectStorageResourceType.name:
                return await this.objectStoragesManager.DeleteResource(resourceReference);
        }
        return null;
    }

    public async ExternalResourceIdChanged(resourceReference: ResourceReference, oldExternalResourceId: string): Promise<void>
    {
        switch(resourceReference.resourceTypeName)
        {
            case resourceProviders.fileServices.fileStorageResourceType.name:
                await this.fileStoragesManager.ExternalResourceIdChanged(resourceReference, oldExternalResourceId);
                break;
        }
    }

    public async InstancePermissionsChanged(resourceReference: ResourceReference): Promise<void>
    {
        switch(resourceReference.resourceTypeName)
        {
            case resourceProviders.fileServices.fileStorageResourceType.name:
                await this.fileStoragesManager.RefreshPermissions(resourceReference);
                break;
        }
    }

    public async ProvideResource(instanceProperties: FileServicesProperties, context: DeploymentContext): Promise<DeploymentResult>
    {
        switch(instanceProperties.type)
        {
            case resourceProviders.fileServices.fileStorageResourceType.name:
                await this.fileStoragesManager.ProvideResource(context);
                break;
            case resourceProviders.fileServices.objectStorageResourceType.name:
                await this.objectStoragesManager.ProvideResource(context.resourceReference);
                break;
        }

        return {};
    }

    public async QueryResourceState(resourceReference: ResourceReference): Promise<ResourceStateResult>
    {
        return "running";
    }
}