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
export class HostConfigController
{
    constructor(private dbConnMgr: DBConnectionsManager)
    {
    }

    //Public methods
    public async QueryConfig<ConfigType>(hostId: number, configKey: string)
    {
        const query = `
        SELECT config
        FROM hosts_configuration
        WHERE hostId = ? AND configKey = ?
        `;
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        const row = await conn.SelectOne(query, hostId, configKey);

        if(row === undefined)
            return undefined;

        return JSON.parse(row.config) as ConfigType;
    }

    public async UpdateOrInsertConfig(hostId: number, configKey: string, config: any)
    {
        const stringConfig = JSON.stringify(config);

        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();

        const result = await conn.UpdateRows("hosts_configuration", { config: stringConfig }, "hostId = ? AND configKey = ?", hostId, configKey);
        if(result.affectedRows === 0)
        {
            await conn.InsertRow("hosts_configuration", {
                config: stringConfig,
                hostId,
                configKey
            });
        }
    }
}