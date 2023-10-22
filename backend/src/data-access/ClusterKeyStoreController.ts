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

@Injectable
export class ClusterKeyStoreController
{
    constructor(private dbConnMgr: DBConnectionsManager)
    {
    }

    //Public methods
    public async QueryHostSecretValue(hostId: number, entryKey: string)
    {
        const query = `
        SELECT value
        FROM keystore_hosts
        WHERE hostId = ? AND entryKey = ?
        `;

        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        const row = await conn.SelectOne(query, hostId, entryKey);
        if(row === undefined)
            return undefined;
        return row.value as Buffer;
    }

    public async UpdateOrInsertHostSecretValue(hostId: number, entryKey: string, encryptedData: Buffer)
    {        
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();

        const result = await conn.UpdateRows("keystore_hosts", { value: encryptedData }, "hostId = ? AND entryKey = ?", hostId, entryKey);
        if(result.affectedRows === 0)
        {
            await conn.InsertRow("keystore_hosts", {
                hostId,
                entryKey,
                value: encryptedData
            });
        }
    }
}