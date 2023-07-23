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
 
@Injectable
export class ErrorService
{
    //Public methods
    public ExtractData(e: unknown): string[]
    {
        if(e === undefined)
            return [];
        if(typeof e === "number")
            return [e.toString()];
        if(typeof e === "string")
            return [e];
        if(e instanceof Error)
            return [e.name, e.message, e.stack ?? ""];

        console.error("unknown type", e);
        return [JSON.stringify(e)];
    }

    public ExtractDataAsMultipleLines(e: unknown)
    {
        return this.ExtractData(e).join("\n");
    }
}