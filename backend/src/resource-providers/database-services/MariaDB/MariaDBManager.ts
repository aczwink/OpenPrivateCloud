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
import { ResourceConfigController } from "../../../data-access/ResourceConfigController";
import { DeploymentContext, DeploymentResult } from "../../ResourceProvider";
import { MySQLGrant } from "../MySQLClient";
import { MariaDBContainerManager } from "./MariaDBContainerManager";
import { MariaDBHostManager } from "./MariaDBHostManager";
import { MariaDBInterface } from "./MariaDBInterface";
import { MariadbProperties } from "./MariadbProperties";
import { ResourceReference } from "../../../common/ResourceReference";
import { ObjectExtensions } from "acts-util-core";

interface MariaDBConfig
{
    deploymentType: "container" | "host";
}

export interface MySQLDatabaseEntry
{
    Database: string;
}

interface MySQLUserEntry
{
    Host: string;
    User: string;
}

@Injectable
export class MariaDBManager
{
    constructor(private instanceConfigController: ResourceConfigController, private mariaDBHostManager: MariaDBHostManager,
        private mariaDBContainerManager: MariaDBContainerManager)
    {
    }

    //Public methods
    public async AddUserPermission(resourceReference: ResourceReference, userName: string, hostName: string, permission: MySQLGrant)
    {
        const mariaDBInterface = await this.QueryInterface(resourceReference.id);
        await mariaDBInterface.AddUserPermission(resourceReference, userName, hostName, permission);
    }

    public async CheckDatabaseIntegrity(resourceReference: ResourceReference)
    {
        const mariaDBInterface = await this.QueryInterface(resourceReference.id);
        const stdOut = await mariaDBInterface.CheckAllDatabases(resourceReference);

        const lines = stdOut.split("\n");
        const entries = lines.filter(line => line.trim().length > 0).map(line => {
            const parts = line.trimEnd().split(/[ \t]+/);
            if(parts.length != 2)
                throw new Error(parts.toString());
            return parts;
        });

        const errorneous = entries.filter(parts => parts[1] !== "OK");
        if(errorneous.length > 0)
        {
            console.log(errorneous);
            throw new Error("DATABASE PROBLEM!");
        }
    }

    public async CreateDatabase(resourceReference: ResourceReference, databaseName: string)
    {
        const mariaDBInterface = await this.QueryInterface(resourceReference.id);
        await mariaDBInterface.CreateDatabase(resourceReference, databaseName);
    }

    public async CreateUser(resourceReference: ResourceReference, userName: string, hostName: string, password: string)
    {
        const mariaDBInterface = await this.QueryInterface(resourceReference.id);
        await mariaDBInterface.CreateUser(resourceReference, userName, hostName, password);
    }

    public async DeleteResource(resourceReference: ResourceReference)
    {
        const mariaDBInterface = await this.QueryInterface(resourceReference.id);
        await mariaDBInterface.DeleteResource(resourceReference);
    }

    public async DeleteUser(resourceReference: ResourceReference, userName: string, hostName: string)
    {
        const mariaDBInterface = await this.QueryInterface(resourceReference.id);
        await mariaDBInterface.DeleteUser(resourceReference, userName, hostName);
    }

    public async ExecuteSelectQuery(resourceReference: ResourceReference, query: string)
    {
        const mariaDBInterface = await this.QueryInterface(resourceReference.id);
        return mariaDBInterface.ExecuteSelectQuery(resourceReference, query);
    }

    public async QueryDatabases(resourceReference: ResourceReference)
    {
        const mariaDBInterface = await this.QueryInterface(resourceReference.id);
        const result = await mariaDBInterface.ExecuteSelectQuery(resourceReference, "SHOW DATABASES");
        return result as MySQLDatabaseEntry[];
    }

    public async QueryUserPermissions(resourceReference: ResourceReference, userName: string, hostName: string)
    {
        const mariaDBInterface = await this.QueryInterface(resourceReference.id);
        const permissions = await mariaDBInterface.ExecuteSelectQuery(resourceReference, "SHOW GRANTS FOR '" + userName + "'@'" + hostName + "'");

        const result = [];
        for (const permission of permissions)
        {
            const parsed = this.ParsePermission(ObjectExtensions.Values(permission).First());
            if(parsed !== null)
                result.push(parsed);
        }

        return result;
    }

    public async QueryUsers(resourceReference: ResourceReference)
    {
        const mariaDBInterface = await this.QueryInterface(resourceReference.id);
        const result = await mariaDBInterface.ExecuteSelectQuery(resourceReference, "SELECT Host, User FROM mysql.user");
        return result as MySQLUserEntry[];
    }

    public async ProvideResource(instanceProperties: MariadbProperties, context: DeploymentContext): Promise<DeploymentResult>
    {
        switch(instanceProperties.deployment.type)
        {
            case "container":
                await this.mariaDBContainerManager.ProvideResource(instanceProperties.deployment, context);
                break;
            case "host":
                await this.mariaDBHostManager.ProvideResource(instanceProperties, context);
                break;
        }

        const config: MariaDBConfig = {
            deploymentType: instanceProperties.deployment.type
        };
        return {
            config
        };
    }

    //Private methods
    private ParsePermission(stringRepresentation: string): MySQLGrant | null
    {
        const regex = /^GRANT (?<privilegeType>.+) ON (?<scope>[^ ]+) TO `(?<userName>[.a-z]+)`@`(?<hostName>[%a-z]+)`(?: IDENTIFIED BY PASSWORD '\*[0-9A-F]+')?(?<hasGrant> WITH GRANT OPTION)?$/;
        const parts = stringRepresentation.match(regex);

        if(parts === null)
        {
            console.log(stringRepresentation);
            return null;
        }
        if(parts.groups!.privilegeType === "PROXY")
            return null;

        return {
            privilegeTypes: parts.groups!.privilegeType.split(",").map(x => x.trim()) as any,
            scope: parts.groups!.scope,
            //userName: parts.groups!.userName,
            //hostName: parts.groups!.hostName,
            hasGrant: parts.groups!.hasGrant !== undefined
        };
    }

    private async QueryConfig(instanceId: number): Promise<MariaDBConfig>
    {
        const config = await this.instanceConfigController.QueryConfig<MariaDBConfig>(instanceId);
        return config!;
    }

    private async QueryInterface(instanceId: number): Promise<MariaDBInterface>
    {
        const config = await this.QueryConfig(instanceId);
        switch(config.deploymentType)
        {
            case "container":
                return this.mariaDBContainerManager;
            case "host":
                return this.mariaDBHostManager;
        }
    }
}