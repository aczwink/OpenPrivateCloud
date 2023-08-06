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

import { AutoCompleteSelectBox, BootstrapIcon, CheckBox, Component, FormField, Injectable, JSX_CreateElement, LineEdit, NumberSpinner, Select } from "acfrontend";
import { OpenAPI, OpenAPISchemaValidator } from "acts-util-core";
import { APISchemaService } from "../../Services/APISchemaService";
import { APIService } from "../../Services/APIService";
import { ResourceSelectionComponent } from "../ValueEditors/ResourceSelectionComponent";
import { RoleSelectionComponent } from "../ValueEditors/RoleSelectionComponent";
import { UserGroupSelectionComponent } from "../ValueEditors/UserGroupSelectionComponent";
import { UserSelectionComponent } from "../ValueEditors/UserSelectionComponent";
import { RenderTitle } from "../ValuePresentation";

export interface ObjectEditorContext
{
    hostName: string;
}

interface ObjectEditorInput
{
    context?: ObjectEditorContext;
    object: any;
    schema: OpenAPI.Schema;
    onObjectUpdated?: (newValue: any) => void;
}

@Injectable
export class ObjectEditorComponent extends Component<ObjectEditorInput>
{
    constructor(private apiSchemaService: APISchemaService, private apiService: APIService)
    {
        super();
    }
    
    //Protected methods
    protected Render(): RenderValue
    {
        return this.RenderValue(this.input.object, this.input.schema, this.NotifyObjectUpdate.bind(this), "");
    }

    //Private methods
    private async LoadHostNames(filterText: string)
    {
        const hosts = await this.apiService.hosts.get();
        filterText = filterText.toLowerCase();

        return hosts.data.Values()
            .Filter(x => x.hostName.includes(filterText.toLowerCase()))
            .Map(x => ({ key: x.hostName, displayValue: x.hostName }))
            .ToArray();
    }

    private NotifyObjectUpdate(newValue: any)
    {
        if(this.input.onObjectUpdated !== undefined)
            this.input.onObjectUpdated(newValue);
        this.Update();
    }

    private RenderArray(value: any[], schema: OpenAPI.ArraySchema, valueChanged: (newValue: any) => void, fallback: string): any
    {
        const context = this;

        function OnAddItem()
        {
            const itemSchema = context.apiSchemaService.ResolveSchemaOrReference(schema.items);
            const newItem = context.apiSchemaService.CreateDefault(itemSchema);
            value.push(newItem);
            valueChanged(value);
        }

        return <fragment>
            <h5>{schema.title ?? fallback}</h5>
            <div className="form-text">{schema.description ?? ""}</div>
            {value.map( (x, idx) => this.RenderValue(x, schema.items, newValue => {
                value[idx] = newValue;
                valueChanged(value);
            }, ""))}
            <button type="button" className="btn btn-primary" onclick={OnAddItem}><BootstrapIcon>plus</BootstrapIcon></button>
        </fragment>
    }

    private RenderMember(value: any, required: boolean, schema: OpenAPI.Schema | OpenAPI.Reference, valueChanged: (newValue: any) => void, fallback: string)
    {
        if(required)
            return this.RenderValue(value, schema, valueChanged, fallback);

        const context = this;
        if(value === undefined)
        {
            function SetDefaultValue()
            {
                const resolvedSchema = context.apiSchemaService.ResolveSchemaOrReference(schema);
                const newValue = context.apiSchemaService.CreateDefault(resolvedSchema);
                valueChanged(newValue);
            }

            return <FormField title={fallback} description="Press the button to define this property">
                <button type="button" className="form-control btn btn-primary" onclick={SetDefaultValue}><BootstrapIcon>plus-slash-minus</BootstrapIcon></button>
            </FormField>;
        }
        return <div className="row">
            <div className="col">
                {this.RenderValue(value, schema, valueChanged, fallback)}
            </div>
            <div className="col-auto">
                <button type="button" className="form-control btn btn-danger" onclick={() => valueChanged(undefined)}><BootstrapIcon>plus-slash-minus</BootstrapIcon></button>
            </div>
        </div>;
    }

    private RenderNumber(value: any, schema: OpenAPI.NumberSchema, valueChanged: (newValue: any) => void)
    {
        if(schema.format !== undefined)
        {
            switch(schema.format)
            {
                case "user":
                    return <UserSelectionComponent userId={value} valueChanged={valueChanged} />;
                case "usergroup":
                    return <UserGroupSelectionComponent userGroupId={value} valueChanged={valueChanged} />;
            }
        }

        let className = "";
        if((schema.minimum !== undefined) || (schema.maximum !== undefined))
        {
            const validator = new OpenAPISchemaValidator(this.apiSchemaService.root);
            className = validator.ValidateNumber(value, schema) ? "is-valid" : "is-invalid";
        }

        return <NumberSpinner className={className} value={value} onChanged={valueChanged} step={1} />;
    }

    private RenderObject(value: any, schema: OpenAPI.ObjectSchema, valueChanged: (newValue: any) => void, fallback: string)
    {
        const required = schema.required.Values().ToSet();

        const keys = Object.keys(schema.properties);
        const children = [];
        for (const key of keys)
        {
            const prop = value[key];
            const renderValue = this.RenderMember(prop, required.has(key), schema.properties[key]!, newValue => {
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

    private RenderOneOf(value: any, oneOfSchema: OpenAPI.OneOfSchema, valueChanged: (newValue: any) => void, fallback: string)
    {
        if(oneOfSchema.discriminator === undefined)
            throw new Error("NOT IMPLEMENTED. NEEED A DISCRIMINATOR");
        const discriminatorPropName = oneOfSchema.discriminator.propertyName;

        function ExtractKey(schema: OpenAPI.ObjectSchema)
        {
            const x = schema.properties[discriminatorPropName] as OpenAPI.StringSchema;
            return x.enum![0];
        }

        const schemasMap = oneOfSchema.oneOf.Values()
            .Map(x => this.apiSchemaService.ResolveSchemaOrReference(x) as OpenAPI.ObjectSchema)
            .ToDictionary(x => ExtractKey(x), x => x);
        const context = this;

        function GetSelectedSchema(selectedDiscriminator: string)
        {
            return schemasMap[selectedDiscriminator]!;
        }
        function OnSelectionChanged(newSelectedDiscriminator: string)
        {
            const newSchema = schemasMap[newSelectedDiscriminator]!;
            const newValue = context.apiSchemaService.CreateDefault(newSchema);
            valueChanged(newValue);
        }
        function CreateSchemaWithoutDiscriminator(schema: OpenAPI.ObjectSchema): OpenAPI.ObjectSchema
        {
            return {
                additionalProperties: schema.additionalProperties,
                properties: schema.properties.Entries().Filter(kv => kv.key !== discriminatorPropName).ToDictionary(kv => kv.key, kv => kv.value!),
                required: schema.required.filter(x => x !== discriminatorPropName),
                type: "object",
                description: schema.description,
                title: schema.title
            };
        }

        const selectedDiscriminator = value[discriminatorPropName];
        const selectedSchema = GetSelectedSchema(selectedDiscriminator);

        return <fragment>
            <FormField title={RenderTitle(selectedSchema, discriminatorPropName)} description={selectedSchema.description}>
                <Select onChanged={newValue => OnSelectionChanged(newValue[0])}>
                    {schemasMap.OwnKeys().OrderBy(x => x).Map(x => <option selected={selectedDiscriminator === x}>{x.toString()}</option>).ToArray()}
                </Select>
            </FormField>
            {this.RenderObject(value, CreateSchemaWithoutDiscriminator(selectedSchema), valueChanged, fallback)}
        </fragment>;
    }

    private RenderString(value: any, schema: OpenAPI.StringSchema, valueChanged: (newValue: any) => void)
    {
        if(schema.enum !== undefined)
        {
            return <Select onChanged={newValue => valueChanged(newValue[0])}>
                {schema.enum.map(x => <option selected={value === x}>{x}</option>)}
            </Select>;
        }

        let className = "";
        if((schema.format !== undefined) || (schema.pattern !== undefined))
        {
            const validator = new OpenAPISchemaValidator(this.apiSchemaService.root);
            className = validator.ValidateString(value, schema) ? "is-valid" : "is-invalid";

            switch(schema.format as string)
            {
                case "hostName":
                    return <AutoCompleteSelectBox
                        onChanged={newValue => valueChanged(newValue.key)}
                        onLoadSuggestions={this.LoadHostNames.bind(this)}
                        selection={ (value.trim().length === 0 ? null : ({ key: value, displayValue: value}))} />;
                case "role":
                    return <RoleSelectionComponent roleId={value} valueChanged={valueChanged} />;
                case "secret":
                    return <LineEdit className={className} password value={value.toString()} onChanged={valueChanged} />;
            }

            if(schema.format?.startsWith("resource[") || schema.format?.startsWith("resource-same-host["))
            {
                const idx = schema.format.indexOf("[");
                const main = schema.format.substring(0, idx);
                const arg = schema.format.substring(idx+1, schema.format.length - 1);
                const parts = arg.split("/");
                const hostName = (main === "resource-same-host") ? (this.input.context!.hostName) : undefined;
                return <ResourceSelectionComponent hostName={hostName} resourceProviderName={parts[0]} resourceTypeName={parts[1]} value={value} valueChanged={valueChanged} />;
            }
        }

        return <LineEdit className={className} value={value.toString()} onChanged={valueChanged} />;
    }

    private RenderValue(value: any, schema: OpenAPI.Schema | OpenAPI.Reference, valueChanged: (newValue: any) => void, fallback: string): any
    {
        if("anyOf" in schema)
            throw new Error("anyof not implemented");
        if("oneOf" in schema)
            return this.RenderOneOf(value, schema, valueChanged, fallback);
        if("$ref" in schema)
            return this.RenderValue(value, this.apiSchemaService.ResolveReference(schema), valueChanged, schema.title || fallback);

        switch(schema.type)
        {
            case "array":
                return this.RenderArray(value, schema, valueChanged, fallback);

            case "boolean":
                return <FormField title={RenderTitle(schema, fallback)} description={schema.description}>
                    <CheckBox value={value} onChanged={valueChanged} />
                </FormField>;

            case "number":
                return <FormField title={RenderTitle(schema, fallback)} description={schema.description}>
                    {this.RenderNumber(value, schema, valueChanged)}
                </FormField>;

            case "object":
                return this.RenderObject(value, schema, valueChanged, fallback);

            case "string":
                return <FormField title={RenderTitle(schema, fallback)} description={schema.description}>
                    {this.RenderString(value, schema, valueChanged)}
                </FormField>;
        }
    }
}