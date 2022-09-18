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

import { Instantiatable } from "acts-util-core";
import { BoundResourceAction } from "./BoundActions";
import { UnboundResourceAction } from "./UnboundActions";

export interface CollectionViewModel<ObjectType, IdType, ServiceType, ObjectCreationType = ObjectType>
{
    type: "collection";

    actions: UnboundResourceAction<ServiceType, ObjectType, ObjectCreationType, IdType>[];
    child: ViewModel;
    displayName: string;
    extractId: (resource: ObjectType) => string;
    idKey: string;
    requestObjects: (service: ServiceType, ids: IdType) => Promise<ObjectType[]>;
    schemaName: string;
    service: Instantiatable<ServiceType>;
}

interface PageEntry
{
    child: ViewModel;
    displayName: string;
    key: string;
}

export interface MultiPageViewModel<IdType, ServiceType>
{
    type: "multiPage";
    actions: BoundResourceAction<IdType, ServiceType>[];
    formTitle: (ids: IdType) => string;
    entries: PageEntry[];
    service: Instantiatable<ServiceType>;
}

export interface ObjectViewModel<ObjectType, IdType, ServiceType>
{
    type: "object";

    actions: BoundResourceAction<IdType, ServiceType>[];
    formTitle: (object: ObjectType) => string;
    requestObject: (service: ServiceType, ids: IdType) => Promise<ObjectType | undefined>;
    schemaName: string;
    service: Instantiatable<ServiceType>;
}

export type ViewModel = CollectionViewModel<any, any, any> | MultiPageViewModel<any, any> | ObjectViewModel<any, any, any>;

export interface ViewModelRoot
{
    key: string;
    viewModel: ViewModel;
}