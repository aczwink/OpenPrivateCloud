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

import { Injectable } from "acfrontend";
import { OpenAPI, OpenAPIDefaultObjectCreator } from "acts-util-core";
import userapi_openapi from "../../dist/openapi.json";

@Injectable
export class APISchemaService
{
    constructor()
    {
        this._root = userapi_openapi as any;
    }

    //Properties
    public get root()
    {
        return this._root;
    }

    //Public methods
    public CreateDefault(schema: OpenAPI.Schema)
    {
        const creator = new OpenAPIDefaultObjectCreator(this._root);
        return creator.Create(schema);
    }
    
    public GetSchema(name: string)
    {
        return this._root.components.schemas[name]!;
    }

    public ResolveReference(reference: OpenAPI.Reference): OpenAPI.Schema | OpenAPI.Reference
    {
        const last = reference.$ref.split("/").pop();
        return this.GetSchema(last!);
    }

    public ResolveSchemaOrReference(schemaOrRef: OpenAPI.Schema | OpenAPI.Reference): OpenAPI.Schema
    {
        if("$ref" in schemaOrRef)
            return this.ResolveSchemaOrReference(this.ResolveReference(schemaOrRef));
        return schemaOrRef;
    }

    //Private variables
    private _root: OpenAPI.Root;
}