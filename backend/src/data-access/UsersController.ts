/**
 * OpenPrivateCloud
 * Copyright (C) 2019-2024 Amir Czwink (amir130@hotmail.de)
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
    privateKey: string;
    publicKey: string;
}

export interface EditableUserData
{
    firstName: string;
}

export interface PublicUserData extends EditableUserData
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
    public async CreateUser(emailAddress: string)
    {
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        const result = await conn.InsertRow("users", { emailAddress, firstName: emailAddress, privateKey: "", publicKey: "" });
        return result.insertId;
    }

    public async DeleteUser(userId: number)
    {
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        await conn.DeleteRows("users_wallet", "userId = ?", userId);
        await conn.DeleteRows("users", "id = ?", userId);
    }

    public async QueryMembersOfGroup(userGroupId: number)
    {
        let query = `
        SELECT u.id, u.firstName, u.emailAddress
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
        SELECT privateKey, publicKey
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
        SELECT id, firstName, emailAddress
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
        SELECT id, firstName, emailAddress
        FROM users
        `;

        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        const rows = await conn.Select<PublicUserData>(query);

        return rows;
    }

    public async UpdateUserData(userId: number, data: EditableUserData)
    {
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        await conn.UpdateRows("users", { firstName: data.firstName }, "id = ?", userId);
    }

    public async UpdateUserKeys(userId: number, privateKey: string, publicKey: string)
    {
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        await conn.UpdateRows("users", { privateKey, publicKey }, "id = ?", userId);
    }
}