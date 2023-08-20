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

import { ResponseData } from "../../dist/api";
import { APIService } from "../Services/APIService";

interface CustomAction<ObjectType, IdType>
{
    type: "custom";
    action: (service: APIService, ids: IdType, object: ObjectType) => Promise<void>;
    matIcon: string;
}

export interface EditAction<ObjectType, IdType>
{
    type: "edit";
    schemaName: string;
    updateResource: (service: APIService, ids: IdType, newProperties: ObjectType, oldProperties: ObjectType, index: number) => Promise<ResponseData<number, number, void>>;
}

export interface DeleteAction<ObjectType, IdType>
{
    type: "delete";
    deleteResource: (service: APIService, ids: IdType, object: ObjectType) => Promise<ResponseData<number, number, void>>;
}

export type ObjectBoundAction<ObjectType, IdType> = CustomAction<ObjectType, IdType> | EditAction<ObjectType, IdType> | DeleteAction<ObjectType, IdType>;