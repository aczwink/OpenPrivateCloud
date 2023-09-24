/**
 * OpenPrivateCloud
 * Copyright (C) 2019-2023 Amir Czwink (amir130@hotmail.de)
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
export class UserWalletController
{
    constructor(private dbConnMgr: DBConnectionsManager)
    {
    }

    //Public methods
    public async QuerySecretNames(userId: number)
    {
        const query = `
        SELECT entryKey
        FROM users_wallet
        WHERE userId = ?
        `;

        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        const rows = await conn.Select(query, userId);
        return rows.map(x => x.entryKey as string);
    }

    public async QuerySecretValue(userId: number, entryKey: string)
    {
        const query = `
        SELECT value
        FROM users_wallet
        WHERE userId = ? AND entryKey = ?
        `;

        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        const row = await conn.SelectOne(query, userId, entryKey);
        if(row === undefined)
            return undefined;
        return Buffer.from((row.value as string), "base64");
    }

    public async UpdateOrInsertSecretValue(userId: number, entryKey: string, encryptedData: Buffer)
    {
        const value = encryptedData.toString("base64");
        
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();

        const result = await conn.UpdateRows("users_wallet", { value }, "userId = ? AND entryKey = ?", userId, entryKey);
        if(result.affectedRows === 0)
        {
            await conn.InsertRow("users_wallet", {
                userId,
                entryKey,
                value
            });
        }
    }
}