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

import { Anchor, JSX_CreateElement, MatIcon, RouterState } from "acfrontend";
import { Dictionary } from "acts-util-core";

interface ManagedDeleteResourceAction<IdType, ServiceType>
{
    type: "delete";
    deleteResource: (service: ServiceType, ids: IdType) => Promise<void>;
}

interface ManagedEditResourceAction<IdType, ObjectType, ServiceType>
{
    type: "edit";
    propertiesSchemaName: string;
    requestObject: (service: ServiceType, ids: IdType) => Promise<ObjectType | undefined>;
    updateResource: (service: ServiceType, ids: IdType, properties: ObjectType) => Promise<void>;
}

export type IdBoundResourceAction<IdType, PropertiesType, ServiceType> =
    ManagedDeleteResourceAction<IdType, ServiceType>
    | ManagedEditResourceAction<IdType, PropertiesType, ServiceType>;

export function RenderBoundAction(baseRoute: string, routeParams: Dictionary<string>, action: IdBoundResourceAction<any, any, any>)
{
    const varRoute = baseRoute + "/" + action.type;
    const route = RouterState.ReplaceRouteParams(varRoute, routeParams).join("/");
    switch(action.type)
    {
        case "delete":
            return <Anchor class="d-flex align-items-center text-decoration-none link-danger" route={route}><MatIcon>delete_forever</MatIcon> Delete</Anchor>;
        case "edit":
            return <Anchor class="d-flex align-items-center text-decoration-none" route={route}><MatIcon>edit</MatIcon> Edit</Anchor>;
    }
}