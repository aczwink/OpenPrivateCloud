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
export class ResourceConfigController
{
    constructor(private dbConnMgr: DBConnectionsManager)
    {
    }

    //Public methods
    public async DeleteConfig(instanceId: number)
    {
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();

        await conn.DeleteRows("instances_configuration", "instanceId = ?", instanceId);
    }

    public async QueryConfig<ConfigType>(instanceId: number)
    {
        const query = `
        SELECT config
        FROM instances_configuration
        WHERE instanceId = ?
        `;
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        const row = await conn.SelectOne(query, instanceId);

        if(row === undefined)
            return undefined;

        return JSON.parse(row.config) as ConfigType;
    }

    public async UpdateOrInsertConfig(instanceId: number, config: any)
    {
        const stringConfig = JSON.stringify(config);

        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();

        const result = await conn.UpdateRows("instances_configuration", { config: stringConfig }, "instanceId = ?", instanceId);
        if(result.affectedRows === 0)
        {
            await conn.InsertRow("instances_configuration", {
                config: stringConfig,
                instanceId
            });
        }
    }
}