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

import { APIController, Body, BodyProp, Common, Delete, Get, Path, Post, Query } from "acts-util-apilib";
import { c_databaseServicesResourceProviderName, c_mariadbResourceTypeName } from "openprivatecloud-common/dist/constants";
import { ResourcesManager } from "../../../services/ResourcesManager";
import { MySQLGrant } from "../MySQLClient";
import { MariaDBManager, MySQLDatabaseEntry } from "./MariaDBManager";
import { ResourceReference } from "../../../common/ResourceReference";
import { ResourceAPIControllerBase } from "../../ResourceAPIControllerBase";

interface MySQLUserCreationData
{
    userName: string;
    hostName: string;
    password: string;
}

@APIController(`resourceProviders/{resourceGroupName}/${c_databaseServicesResourceProviderName}/${c_mariadbResourceTypeName}/{resourceName}`)
class MariaDBAPIController extends ResourceAPIControllerBase
{
    constructor(resourcesManager: ResourcesManager, private mariaDBManager: MariaDBManager)
    {
        super(resourcesManager, c_databaseServicesResourceProviderName, c_mariadbResourceTypeName);
    }

    @Common()
    public async ExtractCommonAPIData(
        @Path resourceGroupName: string,
        @Path resourceName: string
    )
    {
        return this.FetchResourceReference(resourceGroupName, resourceName);
    }

    @Post("databases")
    public async AddDatabase(
        @Common resourceReference: ResourceReference,
        @Body data: MySQLDatabaseEntry,
    )
    {
        await this.mariaDBManager.CreateDatabase(resourceReference, data.Database);
    }

    @Get("databases")
    public async QueryDatabases(
        @Common resourceReference: ResourceReference
    )
    {
        const result = await this.mariaDBManager.QueryDatabases(resourceReference);
        return result;
    }

    @Post("permissions")
    public async AddUserPermission(
        @Common resourceReference: ResourceReference,
        @BodyProp userName: string,
        @BodyProp hostName: string,
        @BodyProp permission: MySQLGrant
    )
    {
        await this.mariaDBManager.AddUserPermission(resourceReference, userName, hostName, permission);
    }

    @Get("permissions")
    public async QueryUserPermissions(
        @Common resourceReference: ResourceReference,
        @Query userName: string,
        @Query hostName: string
    )
    {
        const result = await this.mariaDBManager.QueryUserPermissions(resourceReference, userName, hostName);
        return result;
    }

    @Post("users")
    public async AddUser(
        @Common resourceReference: ResourceReference,
        @Body data: MySQLUserCreationData,
    )
    {
        await this.mariaDBManager.CreateUser(resourceReference, data.userName, data.hostName, data.password);
    }

    @Delete("users")
    public async DeleteUser(
        @Common resourceReference: ResourceReference,
        @BodyProp userName: string,
        @BodyProp hostName: string
    )
    {
        await this.mariaDBManager.DeleteUser(resourceReference, userName, hostName);
    }

    @Get("users")
    public async QueryUsers(
        @Common resourceReference: ResourceReference
    )
    {
        const result = await this.mariaDBManager.QueryUsers(resourceReference);
        return result;
    }
}