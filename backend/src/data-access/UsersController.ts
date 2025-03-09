/**
 * OpenPrivateCloud
 * Copyright (C) 2019-2025 Amir Czwink (amir130@hotmail.de)
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

@Injectable
export class UsersController
{
    constructor(private dbConnMgr: DBConnectionsManager)
    {
    }

    //Public methods
    public async CreateUser(oAuth2Subject: string, userName: string, serviceSecret: string)
    {
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        const result = await conn.InsertRow("users", { oAuth2Subject, userName, serviceSecret });
        return result.insertId;
    }

    public async DeleteUser(userId: number)
    {
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        await conn.DeleteRows("users", "id = ?", userId);
    }

    public async QueryOAuth2Subject(opcUserId: number)
    {
        let query = `
        SELECT oAuth2Subject
        FROM users
        WHERE id = ?
        `;

        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        const row = await conn.SelectOne(query, opcUserId);
        if(row === undefined)
            return undefined;
        return row.oAuth2Subject as string;
    }

    public async QueryUserId(oAuth2Subject: string)
    {
        let query = `
        SELECT id
        FROM users
        WHERE oAuth2Subject = ?
        `;

        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        const row = await conn.SelectOne(query, oAuth2Subject);
        if(row === undefined)
            return undefined;
        return row.id as number;
    }

    public async ReadServiceSecret(userId: number)
    {
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        const row = await conn.SelectOne<{ serviceSecret: string; }>("SELECT serviceSecret FROM users WHERE id = ?", userId);

        return row?.serviceSecret;
    }

    public async UpdateServiceSecret(userId: number, serviceSecret: string)
    {        
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        await conn.UpdateRows("users", { serviceSecret }, "id = ?", userId);
    }
}