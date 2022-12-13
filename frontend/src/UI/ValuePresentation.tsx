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

import { JSX_CreateElement, RootInjector } from "acfrontend";
import { OpenAPI } from "acts-util-core";
import { APISchemaService } from "../Services/APISchemaService";
import { UserValuePresenter } from "./ValuePresenters/UserValuePresenter";

/*
private RenderPermissions(permissions: number, isDir: boolean)
    {
        if(permissions == 0)
            return "no access";

        const parts = [];

        if(isDir)
        {
            if(permissions & 4)
                parts.push("list");
            if(permissions & 2)
                parts.push("modify");
            if(permissions & 1)
                parts.push("access");
        }
        else
        {
            if(permissions & 4)
                parts.push("read");
            if(permissions & 2)
                parts.push("write");
            if(permissions & 1)
                parts.push("execute");
        }

        return parts.join("-");
    }
*/
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
        case "user":
            return <UserValuePresenter userId={value} />;
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
        case "array":
            const childSchema = RootInjector.Resolve(APISchemaService).ResolveSchemaOrReference(schema.items);
            return <ol>{value.map( (x: any) => <li>{RenderReadOnlyValue(x, childSchema)}</li>)}</ol>;
        case "boolean":
            return <div className="form-check">
                <input className="form-check-input" type="checkbox" value="" checked={value} disabled />
            </div>;
        case "number":
            return RenderNumber(value, schema);
        case "string":
            switch(schema.format as string)
            {
                case "date-time":
                    return new Date(value).toLocaleString();
                case "secret":
                    return <input className="form-control" type="password" value={value} disabled />;
            }
            if(schema.format as string === "multi-line")
                return <textarea className="form-control" cols="80" readOnly rows="12">{value}</textarea>;
            return value;
        case "object":
            return <table>
                <tr>
                    <th>Key</th>
                    <th>Value</th>
                </tr>
                {value.Entries().Map( (kv: any) => <tr>
                    <td>{kv.key}</td>
                    <td>{RenderReadOnlyValue(kv.value, RootInjector.Resolve(APISchemaService).ResolveSchemaOrReference(schema.properties[kv.key]!))}</td>
                </tr>).ToArray()}
            </table>;
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