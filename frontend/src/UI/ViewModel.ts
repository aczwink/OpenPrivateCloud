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

import { Component } from "acfrontend";
import { Instantiatable } from "acts-util-core";
import { ResponseData } from "../../dist/api";
import { APIService } from "../Services/APIService";
import { IdBoundResourceAction } from "./IdBoundActions";
import { ListViewModel } from "./ListViewModel";
import { UnboundResourceAction } from "./UnboundActions";

export interface CollectionViewModel<ObjectType, IdType, ObjectCreationType = ObjectType>
{
    type: "collection";

    actions: UnboundResourceAction<ObjectCreationType, IdType>[];
    child: ViewModel;
    displayName: string;
    extractId: (resource: ObjectType) => number | string;
    idKey: string;
    requestObjects: (service: APIService, ids: IdType) => Promise<ResponseData<number, number, ObjectType[]>>;
    schemaName: string;
}

export interface ComponentViewModel
{
    type: "component";
    component: Instantiatable<Component<null | {}>>;
}

interface PageEntry
{
    child: ViewModel;
    displayName: string;
    key: string;
    icon?: {
        type: "bootstrap" | "material";
        name: string;
    }
}

interface PageGroupEntry
{
    displayName: string;
    entries: PageEntry[];
}

export interface MultiPageViewModel<IdType>
{
    type: "multiPage";
    actions: IdBoundResourceAction<IdType, any, APIService>[];
    formTitle: (ids: IdType) => string;
    entries: PageGroupEntry[];
}

export interface ObjectViewModel<ObjectType, IdType>
{
    type: "object";

    actions: IdBoundResourceAction<IdType, ObjectType, APIService>[];
    formTitle: (ids: IdType, object: ObjectType) => string;
    requestObject: (service: APIService, ids: IdType) => Promise<ResponseData<number, number, ObjectType>>;
    schemaName: string;
}

interface RoutingEntry
{
    key: string;
    viewModel: ViewModel;
}

export interface RoutingViewModel
{
    type: "routing";

    entries: RoutingEntry[];
}

export type ViewModel = CollectionViewModel<any, any, any> | ComponentViewModel | ListViewModel<any, any> | MultiPageViewModel<any> | ObjectViewModel<any, any> | RoutingViewModel;