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

import { Dictionary } from "acts-util-core";
import { EnumeratorBuilder } from "acts-util-core/dist/Enumeration/EnumeratorBuilder";
import { Injectable } from "acts-util-node";

export interface DataSourceSchema
{
    dataType: "number" | "string";
    title?: string;
    format?: "date-time-us";
    valueMapping?: object;
}

export interface DataSourceQueryResult
{
    keys: Dictionary<DataSourceSchema>;
    values: EnumeratorBuilder<any>;
}

export interface SourceQueryOptions
{
    maxRecordCount: number;
    startTime: number;
    endTime: number;
}

export interface DataSourceProvider
{    
    QuerySourceData(queryOptions: SourceQueryOptions): Promise<DataSourceQueryResult>;
}

export interface DataSourceCollectionProvider
{
    QueryChildren(): Promise<Dictionary<DataSourcesProvider>>;
}
export type DataSourcesProvider = DataSourceProvider | DataSourceCollectionProvider;

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
            return {
                dataType: (typeof value === "number") ? "number" : "string"
            };
        }

        return obj.Entries().ToDictionary( (kv: any) => kv.key, (kv: any) => ReflectValueType(kv.value!));
    }

    public QueryRootNamespaces()
    {
        return this.providers.OwnKeys();
    }

    public async QuerySourceData(name: string, queryOptions: SourceQueryOptions): Promise<DataSourceQueryResult>
    {
        const parts = name.split(".");
        let provider = this.providers[parts[0]]!;
        for(let i = 1; i < parts.length; i++)
        {
            const children = await provider.QueryChildren()
            const child = children[parts[i]];
            provider = child! as DataSourceCollectionProvider;
        }
        if("QuerySourceData" in provider)
        {
            const leaf = provider as DataSourceProvider;
            return await leaf.QuerySourceData(queryOptions);
        }
        return {
            keys: {
                name: {
                    dataType: "string"
                }
            },
            values: (await provider.QueryChildren()).OwnKeys().Map(k => ({ name: k })),
        };
    }

    public RegisterSourceProvider(rootNameSpace: string, provider: DataSourceCollectionProvider)
    {
        this.providers[rootNameSpace] = provider;
    }

    //Private state
    private providers: Dictionary<DataSourceCollectionProvider>;
}