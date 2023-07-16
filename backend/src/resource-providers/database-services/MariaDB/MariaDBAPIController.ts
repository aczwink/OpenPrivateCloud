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

import { APIController, Body, BodyProp, Common, Delete, Get, NotFound, Path, Post, Query } from "acts-util-apilib";
import { resourceProviders } from "openprivatecloud-common";
import { c_databaseServicesResourceProviderName, c_mariadbResourceTypeName } from "openprivatecloud-common/dist/constants";
import { InstanceContext } from "../../../common/InstanceContext";
import { ResourcesManager } from "../../../services/ResourcesManager";
import { MySQLGrant } from "../MySQLClient";
import { MariaDBManager, MySQLDatabaseEntry } from "./MariaDBManager";

interface MySQLUserCreationData
{
    userName: string;
    hostName: string;
    password: string;
}

@APIController(`resourceProviders/{resourceGroupName}/${c_databaseServicesResourceProviderName}/${c_mariadbResourceTypeName}/{instanceName}`)
class MariaDBAPIController
{
    constructor(private instancesManager: ResourcesManager, private mariaDBManager: MariaDBManager)
    {
    }

    @Common()
    public async ExtractCommonAPIData(
        @Path resourceGroupName: string,
        @Path instanceName: string
    )
    {
        const fullInstanceName = this.instancesManager.TODO_DEPRECATED_CreateUniqueInstanceName(resourceProviders.databaseServices.name, resourceProviders.databaseServices.mariadbResourceType.name, instanceName);
        const instanceContext = await this.instancesManager.TODO_LEGACYCreateInstanceContext(fullInstanceName);
        if(instanceContext === undefined)
            return NotFound("instance not found");

        return instanceContext;
    }

    @Post("databases")
    public async AddDatabase(
        @Common instanceContext: InstanceContext,
        @Body data: MySQLDatabaseEntry,
    )
    {
        await this.mariaDBManager.CreateDatabase(instanceContext, data.Database);
    }

    @Get("databases")
    public async QueryDatabases(
        @Common instanceContext: InstanceContext
    )
    {
        const result = await this.mariaDBManager.QueryDatabases(instanceContext);
        return result;
    }

    @Post("permissions")
    public async AddUserPermission(
        @Common instanceContext: InstanceContext,
        @BodyProp userName: string,
        @BodyProp hostName: string,
        @BodyProp permission: MySQLGrant
    )
    {
        await this.mariaDBManager.AddUserPermission(instanceContext, userName, hostName, permission);
    }

    @Get("permissions")
    public async QueryUserPermissions(
        @Common instanceContext: InstanceContext,
        @Query userName: string,
        @Query hostName: string
    )
    {
        const result = await this.mariaDBManager.QueryUserPermissions(instanceContext, userName, hostName);
        return result;
    }

    @Post("users")
    public async AddUser(
        @Common instanceContext: InstanceContext,
        @Body data: MySQLUserCreationData,
    )
    {
        await this.mariaDBManager.CreateUser(instanceContext, data.userName, data.hostName, data.password);
    }

    @Delete("users")
    public async DeleteUser(
        @Common instanceContext: InstanceContext,
        @BodyProp userName: string,
        @BodyProp hostName: string
    )
    {
        await this.mariaDBManager.DeleteUser(instanceContext, userName, hostName);
    }

    @Get("users")
    public async QueryUsers(
        @Common instanceContext: InstanceContext
    )
    {
        const result = await this.mariaDBManager.QueryUsers(instanceContext);
        return result;
    }
}