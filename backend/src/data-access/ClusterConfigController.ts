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
 
@Injectable
export class ClusterConfigController
{
    constructor(private dbConnMgr: DBConnectionsManager)
    {
    }

    //Public methods
    public async RequestConfig<ConfigType>(key: string)
    {
        const query = `
        SELECT value
        FROM cluster_configuration
        WHERE configKey = ?
        `;
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        const row = await conn.SelectOne(query, key);

        if(row === undefined)
            return undefined;

        return JSON.parse(row.value) as ConfigType;
    }

    public async UpdateOrInsertConfig(key: string, config: any)
    {
        const stringConfig = JSON.stringify(config);

        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();

        const result = await conn.UpdateRows("cluster_configuration", { value: stringConfig }, "configKey = ?", key);
        if(result.affectedRows === 0)
        {
            await conn.InsertRow("cluster_configuration", {
                value: stringConfig,
                configKey: key
            });
        }
    }
}