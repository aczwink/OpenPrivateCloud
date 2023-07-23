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

import { Anchor, BootstrapIcon, JSX_CreateElement, MatIcon, RootInjector, RouterState } from "acfrontend";
import { Dictionary } from "acts-util-core";
import { ResponseData } from "../../dist/api";
import { APIService } from "../Services/APIService";
import { ObjectEditorContext } from "./Components/ObjectEditorComponent";
import { ShowErrorMessageOnErrorFromResponse } from "./ResponseHandler";

interface IdBoundActivateAction<IdType>
{
    type: "activate";
    execute: (service: APIService, ids: IdType) => Promise<ResponseData<number, number, void>>;
    matIcon: string;
    title: string;
}

interface IdBoundConfirmAction<IdType>
{
    type: "confirm";
    confirmText: string;
    execute: (service: APIService, ids: IdType) => Promise<ResponseData<number, number, void>>;
    matIcon: string;
    title: string;
}

interface ManagedDeleteResourceAction<IdType, ServiceType>
{
    type: "delete";
    deleteResource: (service: ServiceType, ids: IdType) => Promise<ResponseData<number, number, void>>;
}

interface ManagedEditResourceAction<IdType, ObjectType>
{
    type: "edit";
    propertiesSchemaName: string;
    loadContext?: (service: APIService, ids: IdType) => Promise<ObjectEditorContext>;
    requestObject: (service: APIService, ids: IdType) => Promise<ResponseData<number, number, ObjectType>>;
    updateResource: (service: APIService, ids: IdType, properties: ObjectType) => Promise<ResponseData<number, number, void>>;
}

interface ManagedCustomEditResourceAction<IdType, ObjectType>
{
    type: "custom_edit";
    key: string;
    title: string;
    icon: string;
    propertiesSchemaName: string;
    requestObject: (service: APIService, ids: IdType) => Promise<ResponseData<number, number, ObjectType>>;
    updateResource: (service: APIService, ids: IdType, properties: ObjectType) => Promise<ResponseData<number, number, void>>;
}

export type IdBoundResourceAction<IdType, PropertiesType, ServiceType> =
    IdBoundActivateAction<IdType>
    | IdBoundConfirmAction<IdType>
    | ManagedDeleteResourceAction<IdType, ServiceType>
    | ManagedEditResourceAction<IdType, PropertiesType>
    | ManagedCustomEditResourceAction<IdType, PropertiesType>;

export function RenderBoundAction(baseRoute: string, routeParams: Dictionary<string>, action: IdBoundResourceAction<any, any, any>, reloadData: (beginOrFinish: boolean) => void)
{
    const varRoute = baseRoute + "/" + (action.type === "custom_edit" ? action.key : action.type);
    const route = RouterState.ReplaceRouteParams(varRoute, routeParams).join("/");
    switch(action.type)
    {
        case "activate":
            async function ExecuteAction(action: IdBoundActivateAction<any>)
            {
                reloadData(true);
                ShowErrorMessageOnErrorFromResponse(await action.execute(RootInjector.Resolve(APIService), routeParams));
                reloadData(false);
            }
            return <a onclick={ExecuteAction.bind(undefined, action)} role="button" className="d-flex align-items-center text-decoration-none"><MatIcon>{action.matIcon}</MatIcon> {action.title}</a>;
        case "confirm":
            async function ConfirmAction(action: IdBoundConfirmAction<any>)
            {
                reloadData(true);
                if(confirm(action.confirmText))
                    ShowErrorMessageOnErrorFromResponse(await action.execute(RootInjector.Resolve(APIService), routeParams));
                reloadData(false);
            }
            return <a onclick={ConfirmAction.bind(undefined, action)} role="button" className="d-flex align-items-center text-decoration-none"><MatIcon>{action.matIcon}</MatIcon> {action.title}</a>;
        case "delete":
            return <Anchor class="d-flex align-items-center text-decoration-none link-danger" route={route}><MatIcon>delete_forever</MatIcon> Delete</Anchor>;
        case "edit":
            return <Anchor class="d-flex align-items-center text-decoration-none" route={route}><MatIcon>edit</MatIcon> Edit</Anchor>;
        case "custom_edit":
            return <Anchor class="d-flex align-items-center text-decoration-none" route={route}><BootstrapIcon>{action.icon}</BootstrapIcon> {action.title}</Anchor>;
    }
}