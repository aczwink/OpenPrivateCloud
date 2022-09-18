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

import { Component, Injectable, JSX_CreateElement, ProgressSpinner, RouterState } from "acfrontend";
import { Dictionary, OpenAPI } from "acts-util-core";
import { APISchemaService } from "../Services/APISchemaService";
import { RenderReadOnlyValue, RenderTitle } from "./ValuePresentation";

interface ObjectInput
{
    heading: (obj: any) => string;
    requestObject: (routeParams: Dictionary<string>) => Promise<any>;
    schema: OpenAPI.ObjectSchema;
}

@Injectable
export class ViewObjectComponent extends Component<ObjectInput>
{
    constructor(private routerState: RouterState, private apiSchemaService: APISchemaService)
    {
        super();

        this.data = null;
        this.heading = "";
    }
    
    protected Render(): RenderValue
    {
        if(this.data === null)
            return <ProgressSpinner />;

        const tables: SingleRenderValue[] = [];
        this.RenderValue(this.data, this.input.schema, tables, "");
        tables.reverse();

        return <fragment>
            <h1>{this.heading}</h1>
            {tables}
        </fragment>;
    }

    //Private variables
    private data: any | null;
    private heading: string;

    //Private methods
    private RenderValue(value: any, schema: OpenAPI.Schema | OpenAPI.Reference, tables: SingleRenderValue[], fallback: string): RenderValue
    {
        if("anyOf" in schema)
            throw new Error("anyof not implemented");
        if("oneOf" in schema)
            throw new Error("oneof not implemented");
        if("$ref" in schema)
            return this.RenderValue(value, this.apiSchemaService.ResolveReference(schema), tables, schema.title || fallback);

        switch(schema.type)
        {
            case "array":
                return <tr>
                    <td>{RenderTitle(schema, fallback)}</td>
                    <td>
                        <table>
                            {...value.map( (x: any) => this.RenderValue(x, schema.items, tables, ""))}
                        </table>
                    </td>
                </tr>;

            case "object":
                {
                    const keys = Object.keys(schema.properties);
                    const children = [];
                    for (const key of keys)
                    {
                        const prop = value[key];
                        const renderValue = this.RenderValue(prop, schema.properties[key]!, tables, key);
                        children.push(renderValue);
                    }

                    const node = <fragment>
                        <h2>{RenderTitle(schema, fallback)}</h2>
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Key</th>
                                    <th>Value</th>
                                </tr>
                            </thead>
                            <tbody>{...children}</tbody>
                        </table>
                    </fragment>;
                    tables.push(node);
                    return null;
                }

            default:
                return <tr>
                    <td>
                        {RenderTitle(schema, fallback)}
                        {schema.description === undefined ? null : <fragment><br /><small className="text-muted">{schema.description}</small></fragment>}
                    </td>
                    <td>{RenderReadOnlyValue(value, schema)}</td>
                </tr>;
        }
    }

    //Event handlers
    public override async OnInitiated()
    {
        this.data = await this.input.requestObject(this.routerState.routeParams);
        this.heading = this.input.heading(this.data);
    }
}