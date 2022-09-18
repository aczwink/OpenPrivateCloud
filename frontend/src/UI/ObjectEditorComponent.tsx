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

import { CheckBox, Component, FormField, Injectable, JSX_CreateElement, LineEdit, NumberSpinner } from "acfrontend";
import { OpenAPI, OpenAPISchemaValidator } from "acts-util-core";
import { APISchemaService } from "../Services/APISchemaService";
import { RenderTitle } from "./ValuePresentation";


@Injectable
export class ObjectEditorComponent extends Component<{
    object: any;
    schema: OpenAPI.Schema;
    onObjectUpdated?: (newValue: any) => void;
}>
{
    constructor(private apiSchemaService: APISchemaService)
    {
        super();
    }
    
    //Protected methods
    protected Render(): RenderValue
    {
        return this.RenderValue(this.input.object, this.input.schema, this.NotifyObjectUpdate.bind(this), "");
    }

    //Private methods
    private NotifyObjectUpdate(newValue: any)
    {
        if(this.input.onObjectUpdated !== undefined)
            this.input.onObjectUpdated(newValue);
        this.Update();
    }

    private RenderValue(value: any, schema: OpenAPI.Schema | OpenAPI.Reference, valueChanged: (newValue: any) => void, fallback: string): any
    {
        if("anyOf" in schema)
            throw new Error("anyof not implemented");
        if("oneOf" in schema)
        {
            throw new Error("oneof not implemented");
            return "oneof TODO";
        }
        if("$ref" in schema)
            return this.RenderValue(value, this.apiSchemaService.ResolveReference(schema), valueChanged, schema.title || fallback);

        let className = "";
        switch(schema.type)
        {
            case "array": //TODO: implement this
                return null;

            case "boolean":
                return <FormField title={RenderTitle(schema, fallback)} description={schema.description}>
                    <CheckBox value={value} onChanged={valueChanged} />
                </FormField>;

            case "number":
                if((schema.minimum !== undefined) || (schema.maximum !== undefined))
                {
                    const validator = new OpenAPISchemaValidator(this.apiSchemaService.root);
                    className = validator.ValidateNumber(value, schema) ? "is-valid" : "is-invalid";
                }

                return <FormField title={RenderTitle(schema, fallback)} description={schema.description}>
                    <NumberSpinner className={className} value={value} onChanged={valueChanged} step={1} />
                </FormField>;

            case "object":
            {
                const keys = Object.keys(schema.properties);
                const children = [];
                for (const key of keys)
                {
                    const prop = value[key];
                    const renderValue = this.RenderValue(prop, schema.properties[key]!, newValue => {
                        value[key] = newValue;
                        valueChanged(value);
                    }, key);
                    children.push(renderValue);
                }

                return <fragment>
                    <h2>{RenderTitle(schema, fallback)}</h2>
                    {...children}
                </fragment>;
            }

            case "string":
                if((schema.enum !== undefined) || (schema.format !== undefined) || (schema.pattern !== undefined))
                {
                    const validator = new OpenAPISchemaValidator(this.apiSchemaService.root);
                    className = validator.ValidateString(value, schema) ? "is-valid" : "is-invalid";
                }

                return <FormField title={RenderTitle(schema, fallback)} description={schema.description}>
                    <LineEdit className={className} value={value.toString()} onChanged={valueChanged} />
                </FormField>;
        }
    }
}