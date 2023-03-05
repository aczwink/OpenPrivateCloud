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
import { DeploymentContext, DeploymentResult, ResourceDeletionError, ResourceProvider, ResourceTypeDefinition } from "../ResourceProvider";
import { InstanceContext } from "../../common/InstanceContext";
import { MariadbProperties } from "./MariaDB/MariadbProperties";
import { MariaDBManager } from "./MariaDB/MariaDBManager";

  
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
    public async CheckInstanceAvailability(instanceContext: InstanceContext): Promise<void>
    {
        const warningCount = await this.mariaDBManager.ExecuteSelectQuery(instanceContext, "SELECT @@warning_count;");
        const errorCount = await this.mariaDBManager.ExecuteSelectQuery(instanceContext, "SELECT @@error_count;");

        if(parseInt(warningCount[0]["@@warning_count"]) != 0)
            throw new Error("Warnings are reported on the database");
        if(parseInt(errorCount[0]["@@error_count"]) != 0)
            throw new Error("Warnings are reported on the database");
    }

    public async CheckInstanceHealth(instanceContext: InstanceContext): Promise<void>
    {
        await this.mariaDBManager.CheckDatabaseIntegrity(instanceContext);
    }
    
    public async DeleteResource(instanceContext: InstanceContext): Promise<ResourceDeletionError | null>
    {
        await this.mariaDBManager.DeleteResource(instanceContext);
        return null;
    }

    public async InstancePermissionsChanged(instanceContext: InstanceContext): Promise<void>
    {
    }

    public async ProvideResource(instanceProperties: MariadbProperties, context: DeploymentContext): Promise<DeploymentResult>
    {
        return await this.mariaDBManager.ProvideResource(instanceProperties, context);
    }
}