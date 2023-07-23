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
import { LightweightResourceReference, ResourceReference } from "../../../common/ResourceReference";
import { MySQLGrant } from "../MySQLClient";

export interface MariaDBInterface
{
    AddUserPermission(resourceReference: LightweightResourceReference, userName: string, hostName: string, permission: MySQLGrant): Promise<void>;
    CheckAllDatabases(resourceReference: LightweightResourceReference): Promise<string>;
    CreateDatabase(resourceReference: LightweightResourceReference, databaseName: string): Promise<void>;
    CreateUser(resourceReference: LightweightResourceReference, userName: string, hostName: string, password: string): Promise<void>;
    DeleteResource(resourceReference: ResourceReference): Promise<void>;
    DeleteUser(resourceReference: LightweightResourceReference, userName: string, hostName: string): Promise<void>;
    ExecuteSelectQuery(resourceReference: LightweightResourceReference, query: string): Promise<any[]>;
}