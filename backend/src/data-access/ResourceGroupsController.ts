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
import { DBConnectionsManager } from "./DBConnectionsManager";

interface ResourceGroupCreationData
{
    name: string;
}

export interface ResourceGroup extends ResourceGroupCreationData
{
    id: number;
}

@Injectable
export class ResourceGroupsController
{
    constructor(private dbConnMgr: DBConnectionsManager)
    {
    }

    //Public methods
    public async CreateGroup(data: ResourceGroupCreationData)
    {
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        const result = await conn.InsertRow("instancegroups", data);
        return result.insertId;
    }

    public async DeleteGroup(id: number)
    {
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        await conn.DeleteRows("instancegroups", "id = ?", id);
    }

    public async QueryGroup(id: number)
    {
        const query = `
        SELECT id, name
        FROM instancegroups
        WHERE id = ?
        `;
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        const rows = await conn.SelectOne<ResourceGroup>(query, id);
        return rows;
    }

    public async QueryGroupByName(name: string)
    {
        const query = `
        SELECT id, name
        FROM instancegroups
        WHERE name = ?
        `;
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        const rows = await conn.SelectOne<ResourceGroup>(query, name);
        return rows;
    }

    public async QueryAllGroups()
    {
        const query = `
        SELECT id, name
        FROM instancegroups
        `;
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        const rows = await conn.Select<ResourceGroup>(query);
        return rows;
    }
}