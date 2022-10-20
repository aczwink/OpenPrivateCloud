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

import { JSX_CreateElement } from "acfrontend";
import { OpenAPI } from "acts-util-core";

function RenderPermissions(permissions: number)
{
    let perms = "";

    if(permissions & 4)
        perms += "r";
    else
        perms += "-";

    if(permissions & 2)
        perms += "w";
    else
        perms += "-";

    if(permissions & 1)
        perms += "x";
    else
        perms += "-";

    return perms;
}

function RenderNumber(value: number, schema: OpenAPI.NumberSchema)
{
    switch(schema.format)
    {
        case "permissions":
            return value.toString(8) + " " + RenderPermissions((value >> 6) & 7) + RenderPermissions((value >> 3) & 7) + RenderPermissions(value & 7);
    }
    return value;
}

export function RenderReadOnlyValue(value: any, schema: OpenAPI.Schema): SingleRenderValue
{
    if("anyOf" in schema)
        throw new Error("anyof not implemented");
    if("oneOf" in schema)
        throw new Error("oneof not implemented");
        
    switch(schema.type)
    {
        case "boolean":
            return <div className="form-check">
                <input className="form-check-input" type="checkbox" value="" checked={value} disabled />
            </div>;
        case "number":
            return RenderNumber(value, schema);
        case "string":
            if(schema.format as string === "multi-line")
                return <textarea className="form-control" cols="80" readOnly rows="12">{value}</textarea>;
            return value;
        default:
            throw new Error(schema.type);
    }
}

export function RenderTitle(schema: OpenAPI.Schema | OpenAPI.Reference, fallback: string)
{
    if("anyOf" in schema)
        throw new Error("anyof not implemented");
    if("oneOf" in schema)
        throw new Error("oneof not implemented");

    return schema.title || fallback;
}