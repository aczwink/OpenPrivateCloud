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
import { InstanceContext } from "../../../common/InstanceContext";
import { InstanceConfigController } from "../../../data-access/InstanceConfigController";
import { DeploymentContext, DeploymentResult } from "../../ResourceProvider";
import { MySQLGrant } from "../MySQLClient";
import { MariaDBContainerManager } from "./MariaDBContainerManager";
import { MariaDBHostManager } from "./MariaDBHostManager";
import { MariaDBInterface } from "./MariaDBInterface";
import { MariadbProperties } from "./MariadbProperties";

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
    constructor(private instanceConfigController: InstanceConfigController, private mariaDBHostManager: MariaDBHostManager,
        private mariaDBContainerManager: MariaDBContainerManager)
    {
    }

    //Public methods
    public async AddUserPermission(instanceContext: InstanceContext, userName: string, hostName: string, permission: MySQLGrant)
    {
        const mariaDBInterface = await this.QueryInterface(instanceContext.instanceId);
        await mariaDBInterface.AddUserPermission(instanceContext, userName, hostName, permission);
    }

    public async CheckDatabaseIntegrity(instanceContext: InstanceContext)
    {
        const mariaDBInterface = await this.QueryInterface(instanceContext.instanceId);
        const stdOut = await mariaDBInterface.CheckAllDatabases(instanceContext);

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

    public async CreateDatabase(instanceContext: InstanceContext, databaseName: string)
    {
        const mariaDBInterface = await this.QueryInterface(instanceContext.instanceId);
        await mariaDBInterface.CreateDatabase(instanceContext, databaseName);
    }

    public async CreateUser(instanceContext: InstanceContext, userName: string, hostName: string, password: string)
    {
        const mariaDBInterface = await this.QueryInterface(instanceContext.instanceId);
        await mariaDBInterface.CreateUser(instanceContext, userName, hostName, password);
    }

    public async DeleteResource(instanceContext: InstanceContext)
    {
        const mariaDBInterface = await this.QueryInterface(instanceContext.instanceId);
        await mariaDBInterface.DeleteResource(instanceContext);
    }

    public async DeleteUser(instanceContext: InstanceContext, userName: string, hostName: string)
    {
        const mariaDBInterface = await this.QueryInterface(instanceContext.instanceId);
        await mariaDBInterface.DeleteUser(instanceContext, userName, hostName);
    }

    public async ExecuteSelectQuery(instanceContext: InstanceContext, query: string)
    {
        const mariaDBInterface = await this.QueryInterface(instanceContext.instanceId);
        return mariaDBInterface.ExecuteSelectQuery(instanceContext, query);
    }

    public async QueryDatabases(instanceContext: InstanceContext)
    {
        const mariaDBInterface = await this.QueryInterface(instanceContext.instanceId);
        const result = await mariaDBInterface.ExecuteSelectQuery(instanceContext, "SHOW DATABASES");
        return result as MySQLDatabaseEntry[];
    }

    public async QueryUserPermissions(instanceContext: InstanceContext, userName: string, hostName: string)
    {
        const mariaDBInterface = await this.QueryInterface(instanceContext.instanceId);
        const permissions = await mariaDBInterface.ExecuteSelectQuery(instanceContext, "SHOW GRANTS FOR '" + userName + "'@'" + hostName + "'");

        const result = [];
        for (const permission of permissions)
        {
            const parsed = this.ParsePermission(permission.Values().First());
            if(parsed !== null)
                result.push(parsed);
        }

        return result;
    }

    public async QueryUsers(instanceContext: InstanceContext)
    {
        const mariaDBInterface = await this.QueryInterface(instanceContext.instanceId);
        const result = await mariaDBInterface.ExecuteSelectQuery(instanceContext, "SELECT Host, User FROM mysql.user");
        return result as MySQLUserEntry[];
    }

    public async ProvideResource(instanceProperties: MariadbProperties, context: DeploymentContext): Promise<DeploymentResult>
    {
        switch(instanceProperties.deploymentType)
        {
            case "container":
                await this.mariaDBContainerManager.ProvideResource(instanceProperties, context);
                break;
            case "host":
                await this.mariaDBHostManager.ProvideResource(instanceProperties, context);
                break;
        }

        const config: MariaDBConfig = {
            deploymentType: instanceProperties.deploymentType
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