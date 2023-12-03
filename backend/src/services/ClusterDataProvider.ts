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

import { Dictionary } from "acts-util-core";
import { EnumeratorBuilder } from "acts-util-core/dist/Enumeration/EnumeratorBuilder";
import { Injectable } from "acts-util-node";

export type DataSourceSchema = "number" | "string";

export interface DataSourceQueryResult
{
    keys: Dictionary<DataSourceSchema>;
    values: EnumeratorBuilder<any>;
}

export interface DataSourcesProvider
{
    readonly rootNameSpace: string;

    QuerySourceData(name: string): Promise<DataSourceQueryResult>;
    QuerySources(): Promise<string[]>;
}

@Injectable
export class ClusterDataProvider
{
    constructor()
    {
        this.providers = {};
    }

    //Public methods
    public BuildSchemaFromObject(obj: any): Dictionary<DataSourceSchema>
    {
        function ReflectValueType(value: any): DataSourceSchema
        {
            if(typeof value === "number")
                return "number";
            return "string";
        }

        return obj.Entries().ToDictionary( (kv: any) => kv.key, (kv: any) => ReflectValueType(kv.value!));
    }

    public async QueryAllSources()
    {
        const all = await this.providers.Values().Map(x => x!.QuerySources()).PromiseAll();
        return all.Values().Map(x => x.Values()).Flatten().ToArray();
    }

    public async QuerySourceData(name: string)
    {
        const rootNameSpace = name.split(".")[0];
        return await this.providers[rootNameSpace]!.QuerySourceData(name);
    }

    public RegisterSourceProvider(provider: DataSourcesProvider)
    {
        this.providers[provider.rootNameSpace] = provider;
    }

    //Private state
    private providers: Dictionary<DataSourcesProvider>;
}