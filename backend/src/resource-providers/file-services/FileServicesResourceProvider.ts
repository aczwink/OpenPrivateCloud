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
import { Injectable } from "acts-util-node";
import { DeploymentContext, DeploymentResult, ResourceCheckResult, ResourceCheckType, ResourceDeletionError, ResourceProvider, ResourceState, ResourceTypeDefinition } from "../ResourceProvider";
import { resourceProviders } from "openprivatecloud-common";
import { FileStoragesManager } from "./FileStoragesManager";
import { ResourceReference } from "../../common/ResourceReference";
import { FileServicesProperties } from "./properties";
import { DataSourcesProvider } from "../../services/ClusterDataProvider";
import { HealthStatus } from "../../data-access/HealthController";

@Injectable
export class FileServicesResourceProvider implements ResourceProvider<FileServicesProperties>
{
    constructor(private fileStoragesManager: FileStoragesManager)
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
                dataIntegrityCheckSchedule: null,
                fileSystemType: "btrfs",
                requiredModules: ["samba"],
                schemaName: "FileStorageProperties"
            },
        ];
    }

    //Public methods
    public async CheckResource(resourceReference: ResourceReference, type: ResourceCheckType): Promise<HealthStatus | ResourceCheckResult>
    {
        switch(resourceReference.resourceTypeName)
        {
            case resourceProviders.fileServices.fileStorageResourceType.name:
                return await this.fileStoragesManager.CheckResourceHealth(resourceReference, type);
        }
        return HealthStatus.Up;
    }
    
    public async DeleteResource(resourceReference: ResourceReference): Promise<ResourceDeletionError | null>
    {
        switch(resourceReference.resourceTypeName)
        {
            case resourceProviders.fileServices.fileStorageResourceType.name:
                return await this.fileStoragesManager.DeleteResource(resourceReference);
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

    public async ResourcePermissionsChanged(resourceReference: ResourceReference): Promise<void>
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
        }

        return {};
    }

    public async QueryResourceState(resourceReference: ResourceReference): Promise<ResourceState>
    {
        switch(resourceReference.resourceTypeName)
        {
            case resourceProviders.fileServices.fileStorageResourceType.name:
                return await this.fileStoragesManager.QueryResourceState(resourceReference);
        }
        return ResourceState.Running;
    }

    public RehostResource(resourceReference: ResourceReference, targetProperties: FileServicesProperties, context: DeploymentContext): Promise<void>
    {
        throw new Error("Method not implemented.");
    }

    public async RequestDataProvider(resourceReference: ResourceReference): Promise<DataSourcesProvider | null>
    {
        return null;
    }
}