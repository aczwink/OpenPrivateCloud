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

import { ResponseData } from "../../dist/api";
import { APIService } from "../Services/APIService";
import { ObjectBoundAction } from "./ObjectBoundActions";
import { UnboundResourceAction } from "./UnboundActions";

export interface ListViewModel<ObjectType, IdType>
{
    type: "list";
    actions: UnboundResourceAction<ObjectType, IdType>[];
    boundActions: ObjectBoundAction<ObjectType, IdType>[];
    displayName: string;
    requestObjects: (service: APIService, ids: IdType) => Promise<ResponseData<number, number, ObjectType[]>>;
    schemaName: string;
}