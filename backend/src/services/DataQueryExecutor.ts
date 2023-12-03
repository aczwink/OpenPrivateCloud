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
import { ClusterDataProvider, DataSourceQueryResult } from "./ClusterDataProvider";

interface ColumnNameFilterOperand
{
    type: "column";
    name: string;
}

interface StringLiteralFilterOperand
{
    type: "string";
    constant: string;
}

type FilterOperand = ColumnNameFilterOperand | StringLiteralFilterOperand;



interface CountQuery
{
    type: "count";
}

interface FilterQuery
{
    type: "filter";
    op: "=" | "in";
    lhs: FilterOperand;
    rhs: FilterOperand;
}

interface ProjectionQuery
{
    type: "projection";
    columnNames: string[];
}

interface SourceQuery
{
    type: "source";
    name: string;
}

interface SourcesQuery
{
    type: "sources";
}

type DataQuery = CountQuery | FilterQuery | ProjectionQuery | SourceQuery | SourcesQuery;

export interface DataQueryRequest
{
    queryPipeline: DataQuery[];
}

@Injectable
export class DataQueryExecutor
{
    constructor(private clusterDataProvider: ClusterDataProvider)
    {
    }

    //Public methods
    public async ExecuteQuery(query: DataQueryRequest)
    {
        return await this.ExecuteQueryPipeline({ keys: {}, values: [].Values<object>() }, query.queryPipeline);
    }

    //Private methods
    private DoFilter(query: FilterQuery, row: any)
    {
        const lhs = this.EvaluateFilterOperand(query.lhs, row);
        const rhs = this.EvaluateFilterOperand(query.rhs, row);
        switch(query.op)
        {
            case "=":
                return lhs === rhs;
            case "in":
                return rhs.includes(lhs);
        }
    }

    private EvaluateFilterOperand(op: FilterOperand, row: any)
    {
        switch(op.type)
        {
            case "column":
                return row[op.name] as string;
            case "string":
                return op.constant;
        }
    }

    private async ExecutePart(query: DataQuery, prevResult: DataSourceQueryResult): Promise<DataSourceQueryResult>
    {
        switch(query.type)
        {
            case "count":
                return {
                    keys: {
                        count: "number"
                    },
                    values: [{ count: prevResult.values.Count() }].Values()
                };

            case "filter":
                return {
                    keys: prevResult.keys,
                    values: prevResult.values.Filter(this.DoFilter.bind(this, query))
                };

            case "projection":
                return {
                    keys: prevResult.keys.Entries().Filter(x => query.columnNames.includes(x.key.toString())).ToDictionary(kv => kv.key, kv => kv.value!),
                    values: prevResult.values.Map(x => x.Entries().Filter( (kv: any) => query.columnNames.includes(kv.key.toString())).ToDictionary( (kv: any) => kv.key, (kv: any) => kv.value) )
                };

            case "source":
                return await this.clusterDataProvider.QuerySourceData(query.name);

            case "sources":
                return {
                    keys: {
                        name: "string"
                    },
                    values: (await this.clusterDataProvider.QueryAllSources()).Values().Map(x => ({ name: x}))
                };
        }
    }

    private async ExecuteQueryPipeline(prevResult: DataSourceQueryResult, query: DataQuery[]): Promise<DataSourceQueryResult>
    {
        if(query.length === 0)
            return prevResult;

        const result = await this.ExecutePart(query[0], prevResult);
        return await this.ExecuteQueryPipeline(result, query.slice(1));
    }
}