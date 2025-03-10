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
import { resourceProviders } from "openprivatecloud-common";
import { DeploymentContext, DeploymentResult, ResourceCheckResult, ResourceCheckType, ResourceDeletionError, ResourceProvider, ResourceState, ResourceTypeDefinition } from "../ResourceProvider";
import { MariadbProperties } from "./MariaDB/MariadbProperties";
import { MariaDBManager } from "./MariaDB/MariaDBManager";
import { ResourceReference } from "../../common/ResourceReference";
import { DataSourcesProvider } from "../../services/ClusterDataProvider";
import { HealthStatus } from "../../data-access/HealthController";

  
@Injectable
export class DatabaseServicesResourceProvider implements ResourceProvider<MariadbProperties>
{
    constructor(private mariaDBManager: MariaDBManager)
    {
    }

    //Properties
    public get name(): string
    {
        return resourceProviders.databaseServices.name;
    }

    public get resourceTypeDefinitions(): ResourceTypeDefinition[]
    {
        return [
            {
                dataIntegrityCheckSchedule: {
                    type: "daily",
                    atHour: 3,
                },
                fileSystemType: "ext4",
                requiredModules: [],
                schemaName: "MariadbProperties"
            }
        ];
    }

    //Public methods
    public async CheckResource(resourceReference: ResourceReference, type: ResourceCheckType): Promise<HealthStatus | ResourceCheckResult>
    {
        switch(type)
        {
            case ResourceCheckType.DataIntegrity:
            {
                await this.mariaDBManager.CheckDatabaseIntegrity(resourceReference);
            }
            break;
        }

        return HealthStatus.Up;
    }
    
    public async DeleteResource(resourceReference: ResourceReference): Promise<ResourceDeletionError | null>
    {
        await this.mariaDBManager.DeleteResource(resourceReference);
        return null;
    }

    public async ExternalResourceIdChanged(resourceReference: ResourceReference, oldExternalResourceId: string): Promise<void>
    {
    }

    public async ResourcePermissionsChanged(resourceReference: ResourceReference): Promise<void>
    {
    }

    public async ProvideResource(instanceProperties: MariadbProperties, context: DeploymentContext): Promise<DeploymentResult>
    {
        return await this.mariaDBManager.ProvideResource(instanceProperties, context);
    }

    public async QueryResourceState(resourceReference: ResourceReference): Promise<ResourceState>
    {
        const warningCount = await this.mariaDBManager.ExecuteSelectQuery(resourceReference, "SELECT @@warning_count;");
        const errorCount = await this.mariaDBManager.ExecuteSelectQuery(resourceReference, "SELECT @@error_count;");

        if(parseInt(warningCount[0]["@@warning_count"]) != 0)
            throw new Error("Warnings are reported on the database");
        if(parseInt(errorCount[0]["@@error_count"]) != 0)
            throw new Error("Warnings are reported on the database");
            
        return ResourceState.Running;
    }

    public RehostResource(resourceReference: ResourceReference, targetProperties: MariadbProperties, context: DeploymentContext): Promise<void>
    {
        throw new Error("Method not implemented.");
    }

    public async RequestDataProvider(resourceReference: ResourceReference): Promise<DataSourcesProvider | null>
    {
        return null;
    }
}