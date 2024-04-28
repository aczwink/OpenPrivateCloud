/**
 * OpenPrivateCloud
 * Copyright (C) 2023-2024 Amir Czwink (amir130@hotmail.de)
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
import { SecurityServicesProperties } from "./properties";
import { ResourceReference } from "../../common/ResourceReference";
import { KeyVaultManager } from "./KeyVaultManager";
import { WAFManager } from "./WAFManager";
import { DataSourcesProvider } from "../../services/ClusterDataProvider";
 
@Injectable
export class SecurityServicesResourceProvider implements ResourceProvider<SecurityServicesProperties>
{
    constructor(private keyVaultManager: KeyVaultManager, private wafManager: WAFManager)
    {
    }

    //Properties
    public get name(): string
    {
        return resourceProviders.securityServices.name;
    }

    public get resourceTypeDefinitions(): ResourceTypeDefinition[]
    {
        return [
            {
                fileSystemType: "btrfs",
                healthCheckSchedule: null,
                schemaName: "KeyVaultProperties"
            },
            {
                fileSystemType: "btrfs",
                healthCheckSchedule: null,
                schemaName: "WAFProperties"
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
            case resourceProviders.securityServices.keyVaultResourceTypeName.name:
                await this.keyVaultManager.DeleteResource(resourceReference);
                break;
            case resourceProviders.securityServices.wafResourceTypeName.name:
                await this.wafManager.DeleteResource(resourceReference);
                break;
        }

        return null;
    }

    public async ExternalResourceIdChanged(resourceReference: ResourceReference, oldExternalResourceId: string): Promise<void>
    {
    }

    public async InstancePermissionsChanged(resourceReference: ResourceReference): Promise<void>
    {
    }

    public async ProvideResource(instanceProperties: SecurityServicesProperties, context: DeploymentContext): Promise<DeploymentResult>
    {
        switch(instanceProperties.type)
        {
            case "key-vault":
                await this.keyVaultManager.ProvideResource(instanceProperties, context);
                return {};
            case "web-application-firewall":
                await this.wafManager.ProvideResource(instanceProperties, context);
                return {};
        }
    }

    public async QueryResourceState(resourceReference: ResourceReference): Promise<ResourceStateResult>
    {
        switch(resourceReference.resourceTypeName)
        {
            case resourceProviders.securityServices.keyVaultResourceTypeName.name:
                return await this.keyVaultManager.QueryResourceState(resourceReference);
            case resourceProviders.securityServices.wafResourceTypeName.name:
                return await this.wafManager.QueryResourceState(resourceReference);
        }
        return "corrupt";
    }

    public async RequestDataProvider(resourceReference: ResourceReference): Promise<DataSourcesProvider | null>
    {
        return null;
    }
}