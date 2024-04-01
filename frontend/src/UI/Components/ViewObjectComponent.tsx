/**
 * OpenPrivateCloud
 * Copyright (C) 2019-2024 Amir Czwink (amir130@hotmail.de)
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
import { ResponseData } from "../../../dist/api";
import { APISchemaService } from "../../Services/APISchemaService";
import { IdBoundResourceAction, RenderBoundAction } from "../IdBoundActions";
import { ExtractDataFromResponseOrShowErrorMessageOnError } from "../ResponseHandler";
import { RenderReadOnlyValue, RenderTitle } from "../ValuePresentation";

interface ObjectInput<ObjectType>
{
    actions: IdBoundResourceAction<any, any, any>[];
    baseRoute: string;
    heading: (ids: any, obj: any) => string;
    requestObject: (routeParams: Dictionary<string>) => Promise<ResponseData<number, number, ObjectType>>;
    schema: OpenAPI.ObjectSchema;
}

@Injectable
export class ViewObjectComponent<ObjectType> extends Component<ObjectInput<ObjectType>>
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
            <div className="row align-items-center">
                <div className="col-auto"><h2>{this.heading}</h2></div>
                {...this.input.actions.map(x => <div className="col-auto">{RenderBoundAction(this.input.baseRoute, this.routerState.routeParams, x, this.LoadCallback.bind(this))}</div>)}
            </div>
            {tables}
        </fragment>;
    }

    //Private variables
    private data: ObjectType | null;
    private heading: string;

    //Private methods
    private LoadCallback(beginOrFinish: boolean)
    {
        if(beginOrFinish)
            this.data = null;
        else
            this.LoadData();
    }

    private async LoadData()
    {
        const response = await this.input.requestObject(this.routerState.routeParams);
        const result = await ExtractDataFromResponseOrShowErrorMessageOnError(response);
        if(result.ok)
            this.data = result.value;
        this.heading = this.input.heading(this.routerState.routeParams, this.data);
    }

    private RenderOneOf(value: any, oneOfSchema: OpenAPI.OneOfSchema, tables: SingleRenderValue[]): RenderValue
    {
        if(oneOfSchema.discriminator === undefined)
            throw new Error("NOT IMPLEMENTED. NEEED A DISCRIMINATOR");
        const discriminatorPropName = oneOfSchema.discriminator.propertyName;
        const selectedDiscriminator = value[discriminatorPropName];

        function ExtractKey(schema: OpenAPI.ObjectSchema)
        {
            const x = schema.properties[discriminatorPropName] as OpenAPI.StringSchema;
            return x.enum![0];
        }
        
        const selectedSchema = oneOfSchema.oneOf.Values()
            .Map(x => this.apiSchemaService.ResolveSchemaOrReference(x) as OpenAPI.ObjectSchema)
            .Filter(x => ExtractKey(x) === selectedDiscriminator)
            .First();

        return this.RenderValue(value, selectedSchema, tables, "");
    }

    private RenderValue(value: any, schema: OpenAPI.Schema | OpenAPI.Reference, tables: SingleRenderValue[], fallback: string): RenderValue
    {
        if("anyOf" in schema)
            throw new Error("anyof not implemented");
        if("oneOf" in schema)
            return this.RenderOneOf(value, schema, tables);
        if("$ref" in schema)
            return this.RenderValue(value, this.apiSchemaService.ResolveReference(schema), tables, schema.title || fallback);

        switch(schema.type)
        {
            case "array":
                return <tr>
                    <td>
                        {RenderTitle(schema, fallback)}
                        {schema.description === undefined ? null : <fragment><br /><small className="text-muted">{schema.description}</small></fragment>}
                    </td>
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
                        if(prop === undefined)
                            continue;

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
    public override OnInitiated()
    {
        this.LoadData();
    }
}