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
import { resourceProviders } from "openprivatecloud-common";
import { DeploymentContext, DeploymentResult, ResourceDeletionError, ResourceProvider, ResourceStateResult, ResourceTypeDefinition } from "../ResourceProvider";
import { MariadbProperties } from "./MariaDB/MariadbProperties";
import { MariaDBManager } from "./MariaDB/MariaDBManager";
import { ResourceReference } from "../../common/ResourceReference";

  
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
                healthCheckSchedule: {
                    type: "daily",
                    atHour: 3,
                },
                fileSystemType: "ext4",
                schemaName: "MariadbProperties"
            }
        ];
    }

    //Public methods
    public async CheckResourceHealth(resourceReference: ResourceReference): Promise<void>
    {
        await this.mariaDBManager.CheckDatabaseIntegrity(resourceReference);
    }
    
    public async DeleteResource(resourceReference: ResourceReference): Promise<ResourceDeletionError | null>
    {
        await this.mariaDBManager.DeleteResource(resourceReference);
        return null;
    }

    public async ExternalResourceIdChanged(resourceReference: ResourceReference, oldExternalResourceId: string): Promise<void>
    {
    }

    public async InstancePermissionsChanged(resourceReference: ResourceReference): Promise<void>
    {
    }

    public async ProvideResource(instanceProperties: MariadbProperties, context: DeploymentContext): Promise<DeploymentResult>
    {
        return await this.mariaDBManager.ProvideResource(instanceProperties, context);
    }

    public async QueryResourceState(resourceReference: ResourceReference): Promise<ResourceStateResult>
    {
        const warningCount = await this.mariaDBManager.ExecuteSelectQuery(resourceReference, "SELECT @@warning_count;");
        const errorCount = await this.mariaDBManager.ExecuteSelectQuery(resourceReference, "SELECT @@error_count;");

        if(parseInt(warningCount[0]["@@warning_count"]) != 0)
            throw new Error("Warnings are reported on the database");
        if(parseInt(errorCount[0]["@@error_count"]) != 0)
            throw new Error("Warnings are reported on the database");
            
        return "running";
    }
}