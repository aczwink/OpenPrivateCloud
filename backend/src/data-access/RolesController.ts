/**
 * OpenPrivateCloud
 * Copyright (C) 2019-2022 Amir Czwink (amir130@hotmail.de)
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
import { DBConnectionsManager } from "./DBConnectionsManager";

export interface RoleDefinition
{
    id: string;
    name: string;
}

@Injectable
export class RolesController
{
    constructor(private dbConnMgr: DBConnectionsManager)
    {
    }

    //Public methods
    public async RequestMatchingRoles(filter: string)
    {
        const query = `
        SELECT CAST(id AS char) AS id, name
        FROM roles
        WHERE name LIKE ?
        `;

        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        const rows = await conn.Select<RoleDefinition>(query, "%" + filter + "%");

        return rows;
    }

    public async RequestRole(roleId: string)
    {
        const query = `
        SELECT CAST(id AS char) AS id, name
        FROM roles
        WHERE id = ?
        `;

        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        const row = await conn.SelectOne<RoleDefinition>(query, roleId);

        return row;
    }
}