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
    id: number;
    pwHash: string;
    pwSalt: string;
}

interface PublicUserData
{
    emailAddress: string;
}

@Injectable
export class UsersController
{
    constructor(private dbConnMgr: DBConnectionsManager)
    {
    }

    //Public methods
    public async CreateUser(emailAddress: string, pwHash: string, pwSalt: string)
    {
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        await conn.InsertRow("users", { emailAddress, pwHash, pwSalt });
    }

    public async QueryUser(emailAddress: string)
    {
        let query = `
        SELECT id, pwHash, pwSalt
        FROM users
        WHERE emailAddress = ?
        `;

        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        const row = await conn.SelectOne<PrivateUserData>(query, emailAddress);

        return row;
    }

    public async QueryUsers()
    {
        let query = `
        SELECT emailAddress
        FROM users
        `;

        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        const rows = await conn.Select<PublicUserData>(query);

        return rows;
    }
}