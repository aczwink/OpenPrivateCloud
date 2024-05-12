/**
 * OpenPrivateCloud
 * Copyright (C) 2023-2024 Amir Czwink (amir130@hotmail.de)
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

import { APIController, Body, Patch } from "acts-util-apilib";
import { DataQueryExecutor, DataQueryRequest } from "../services/DataQueryExecutor";
import { DataSourceSchema } from "../services/ClusterDataProvider";

interface DataQueryKeyEntry
{
    name: string;
    schema: DataSourceSchema;
}

interface DataQueryResponse
{
    keys: DataQueryKeyEntry[];
    values: object[];
}

@APIController("data")
class _api_
{
    constructor(private executor: DataQueryExecutor)
    {
    }

    @Patch()
    public async QueryData(
        @Body query: DataQueryRequest
    ): Promise<DataQueryResponse>
    {
        const result = await this.executor.ExecuteQuery(query);
        return {
            keys: result.keys.Entries().Map(kv => ({ name: kv.key.toString(), schema: kv.value! })).ToArray(),
            values: result.values.Take(500).ToArray()
        };
    }
}