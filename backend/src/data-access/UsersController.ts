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

interface PrivateUserData
{
    pwHash: string;
    pwSalt: string;
    sambaPW: string;
}

interface PublicUserData
{
    id: number;
    emailAddress: string;
}

@Injectable
export class UsersController
{
    constructor(private dbConnMgr: DBConnectionsManager)
    {
    }

    //Public methods
    public async CreateUser(emailAddress: string, pwHash: string, pwSalt: string, sambaPW: string)
    {
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        await conn.InsertRow("users", { emailAddress, pwHash, pwSalt, sambaPW });
    }

    public async QueryMembersOfGroup(userGroupId: number)
    {
        let query = `
        SELECT u.id, u.emailAddress
        FROM users u
        INNER JOIN usergroups_members ugm
            ON u.id = ugm.userId
        WHERE ugm.groupId = ?
        `;

        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        const rows = await conn.Select<PublicUserData>(query, userGroupId);

        return rows;
    }

    public async QueryPrivateData(id: number)
    {
        let query = `
        SELECT pwHash, pwSalt, sambaPW
        FROM users
        WHERE id = ?
        `;

        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        const row = await conn.SelectOne<PrivateUserData>(query, id);

        return row;
    }

    public async QueryUserId(emailAddress: string)
    {
        let query = `
        SELECT id
        FROM users
        WHERE emailAddress = ?
        `;

        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        const row = await conn.SelectOne(query, emailAddress);
        if(row === undefined)
            return undefined;
        return row.id as number;
    }

    public async QueryUser(userId: number)
    {
        let query = `
        SELECT id, emailAddress
        FROM users
        WHERE id = ?
        `;

        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        const row = await conn.SelectOne<PublicUserData>(query, userId);

        return row;
    }

    public async QueryUsers()
    {
        let query = `
        SELECT id, emailAddress
        FROM users
        `;

        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        const rows = await conn.Select<PublicUserData>(query);

        return rows;
    }

    public async UpdateSambaPassword(userId: number, newPassword: string)
    {
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        await conn.UpdateRows("users", { sambaPW: newPassword }, "id = ?", userId);
    }

    public async UpdateUserPassword(userId: number, pwSalt: string, pwHash: string)
    {
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        await conn.UpdateRows("users", { pwHash, pwSalt }, "id = ?", userId);
    }
}