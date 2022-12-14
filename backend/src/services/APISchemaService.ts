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

import { OpenAPI, OpenAPIDefaultObjectCreator, OpenAPISchemaValidator } from "acts-util-core";

export class APISchemaService
{
    constructor(private root: OpenAPI.Root)
    {
    }

    //Public methods
    public CreateDefault(schema: OpenAPI.Schema)
    {
        const creator = new OpenAPIDefaultObjectCreator(this.root);
        return creator.Create(schema);
    }
    
    public GetSchema(name: string)
    {
        return this.root.components.schemas[name]!;
    }
    
    public Validate(value: any, schemaName: string)
    {
        const openAPIValidator = new OpenAPISchemaValidator(this.root);
        return openAPIValidator.Validate(value, this.root.components.schemas[schemaName]!);
    }
}