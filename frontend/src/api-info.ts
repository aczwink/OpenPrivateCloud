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
import { OpenAPI } from "acts-util-core";
import root from "../dist/openapi.json";
import { APIResponse } from "acfrontend";

export async function APIMap<T, U>(request: Promise<APIResponse<T>>, mapper: (source: T) => U): Promise<APIResponse<U>>
{
    const response = await request;
    if(response.data === undefined)
        return response as any;
    return {
        rawBody: response.rawBody,
        statusCode: response.statusCode,
        data: mapper(response.data)
    };
}

const apiSchemas = root.components.schemas;
export function APISchemaOf<T>( mapper: (schemas: typeof apiSchemas) => T)
{
    return mapper(apiSchemas) as OpenAPI.ObjectSchema;
}

export function OpenAPISchema<T>(schemaName: keyof typeof apiSchemas)
{
    return apiSchemas[schemaName] as OpenAPI.ObjectSchema;
}