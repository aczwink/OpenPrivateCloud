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

interface UserGroup
{
    id: number;
    name: string;
}

@Injectable
export class UserGroupsController
{
    constructor(private dbConnMgr: DBConnectionsManager)
    {
    }

    //Public methods
    public async AddMember(userGroupId: number, userId: number)
    {
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        await conn.InsertRow("usergroups_members", { groupId: userGroupId, userId });
    }

    public async CreateGroup(name: string)
    {
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        const result = await conn.InsertRow("usergroups", { name });
        return result.insertId;
    }

    public async QueryUserGroup(id: number)
    {
        let query = `
        SELECT id, name
        FROM usergroups
        WHERE id = ?
        `;

        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        const row = await conn.SelectOne<UserGroup>(query, id);

        return row;
    }

    public async QueryUserGroups()
    {
        let query = `
        SELECT id, name
        FROM usergroups
        `;

        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        const rows = await conn.Select<UserGroup>(query);

        return rows;
    }

    public async RemoveMembership(userGroupId: number, userId: number)
    {
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        await conn.DeleteRows("usergroups_members", "groupId = ? AND userId = ?", userGroupId, userId);
    }
}