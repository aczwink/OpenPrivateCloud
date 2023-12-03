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

import { DataQuery, DataQueryRequest, FilterOperand } from "../../../dist/api";

export class QueryLanguageParser
{
    //Public methods
    public ParseQuery(query: string): DataQueryRequest
    {
        const operands = query.split("|");

        return {
            queryPipeline: operands.map(this.ParseOperand.bind(this))
        };
    }

    //Private methods
    private ParseFilter(args: string[]): DataQuery
    {
        switch(args[1])
        {
            case "=":
            case "in":
                return {
                    type: "filter",
                    op: args[1],
                    lhs: this.ParseFilterOperand(args[0]),
                    rhs: this.ParseFilterOperand(args[2]),
                }
            default:
                throw new Error("Unknown operator: " + args[1]);
        }
    }

    private ParseFilterOperand(value: string): FilterOperand
    {
        if(value.startsWith('"') && value.endsWith('"'))
        {
            return {
                type: "string",
                constant: value.substring(1, value.length - 1)
            };
        }
        
        const float = parseFloat(value);
        if(!isNaN(float))
        {
            return {
                type: "string",
                constant: value
            };
        }

        return {
            type: "column",
            name: value
        };
    }

    private ParseOperand(operand: string): DataQuery
    {
        const parts = operand.trim().split(/[ \n]+/);

        switch(parts[0])
        {
            case "count":
                if(parts.length > 1)
                    throw new Error("'count' does not accept arguments");
                return {
                    type: "count",
                };

            case "filter":
                return this.ParseFilter(parts.slice(1));

            case "project":
                return {
                    type: "projection",
                    columnNames: parts.slice(1)
                };

            case "source":
                return {
                    type: "source",
                    name: parts[1]
                };

            case "sources":
                if(parts.length > 1)
                    throw new Error("'sources' does not accept arguments");
                return {
                    type: "sources",
                };

            default:
                throw new Error("Unknown operator: " + parts[0]);
        }
    }
}