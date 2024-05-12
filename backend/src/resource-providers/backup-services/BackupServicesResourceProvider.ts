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
import { DeploymentContext, DeploymentResult, ResourceDeletionError, ResourceProvider, ResourceStateResult, ResourceTypeDefinition } from "../ResourceProvider";
import { BackupVaultProperties } from "./BackupVaultProperties";
import { resourceProviders } from "openprivatecloud-common";
import { BackupVaultManager } from "./BackupVaultManager";
import { ResourceReference } from "../../common/ResourceReference";
import { DataSourcesProvider } from "../../services/ClusterDataProvider";

@Injectable
export class BackupServicesResourceProvider implements ResourceProvider<BackupVaultProperties>
{
    constructor(private backupVaultManager: BackupVaultManager)
    {
    }

    //Properties
    public get name(): string
    {
        return resourceProviders.backupServices.name;
    }

    public get resourceTypeDefinitions(): ResourceTypeDefinition[]
    {
        return [
            {
                healthCheckSchedule: null,
                fileSystemType: "btrfs",
                requiredModules: ["webdav"],
                schemaName: "BackupVaultProperties"
            }
        ];
    }

    //Public methods
    public async CheckResourceHealth(resourceReference: ResourceReference): Promise<void>
    {
    }
    
    public async DeleteResource(resourceReference: ResourceReference): Promise<ResourceDeletionError | null>
    {
        return null;
    }

    public async ExternalResourceIdChanged(resourceReference: ResourceReference, oldExternalResourceId: string): Promise<void>
    {
    }

    public async ResourcePermissionsChanged(resourceReference: ResourceReference): Promise<void>
    {
    }

    public async ProvideResource(instanceProperties: BackupVaultProperties, context: DeploymentContext): Promise<DeploymentResult>
    {        
        //this is a virtual resource
        return {};
    }

    public async QueryResourceState(resourceReference: ResourceReference): Promise<ResourceStateResult>
    {
        this.backupVaultManager.EnsureBackupTimerIsRunningIfConfigured(resourceReference.id);
        return this.backupVaultManager.QueryResourceState(resourceReference);
    }

    public async RequestDataProvider(resourceReference: ResourceReference): Promise<DataSourcesProvider | null>
    {
        return null;
    }
}