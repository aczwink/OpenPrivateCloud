/**
 * OpenPrivateCloud
 * Copyright (C) 2023-2024 Amir Czwink (amir130@hotmail.de)
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

import { IdBoundObjectAction, NamedSchemaRegistry, RouteSetup } from "acfrontendex";
import { ResourceHealthDTO, ResourceState } from "../../../dist/api";
import { APIService } from "../../services/APIService";
import { Use } from "acfrontend";
import { APIMap, APISchemaOf, OpenAPISchema } from "../../api-info";
import { BuildAccessControlViewModel } from "./accesscontrol";


function BuildHealthViewModel(buildResourceId: (resourceGroupName: string, resourceName: string) => string)
{
    const schema = OpenAPISchema("AnyResourceProperties");
    const healthViewModel: RouteSetup<ResourceAndGroupId, ResourceHealthDTO> = {
        content: {
            type: "object",
            actions: [
                {
                    type: "custom_edit",
                    key: "rehost",
                    title: "Rehost",
                    icon: "send",
                    loadContext: ids => {
                        const request = Use(APIService).health.resource.get({ id: buildResourceId(ids.resourceGroupName, ids.resourceName) });
                        return APIMap(request, x => ({ hostName: x.hostName }));
                    },
                    requestObject: async _ => ({ rawBody: null, statusCode: 200, data: Use(NamedSchemaRegistry).CreateDefault(schema)}),
                    schema,
                    updateResource: (ids, newData) => Use(APIService).resourceGroups._any_.resources.rehost.patch(ids.resourceGroupName, { resourceId: buildResourceId(ids.resourceGroupName, ids.resourceName), targetProperties: newData as any })
                }
            ],
            formTitle: _ => "Resource health",
            requestObject: ids => Use(APIService).health.resource.get({ id: buildResourceId(ids.resourceGroupName, ids.resourceName) }),
            schema: APISchemaOf(x => x.ResourceHealthDTO)
        },
        displayText: "Health",
        icon: "heart-pulse",
        routingKey: "health"
    };

    return healthViewModel;
}

type ResourceAndGroupId = { resourceGroupName: string; resourceName: string };

export function BuildCommonResourceActions(buildResourceId: (resourceGroupName: string, resourceName: string) => string): IdBoundObjectAction<ResourceAndGroupId, any>[]
{
    return [
        {
            type: "custom_edit",
            key: "rename",
            title: "Rename",
            icon: "pen",
            requestObject: async ids => ({ statusCode: 200, data: { name: ids.resourceName }, rawBody: null }),
            schema: OpenAPISchema("ResourceGroupDTO"),
            updateResource: (ids, newData) => Use(APIService).resourceGroups._any_.resources.name.patch(ids.resourceGroupName, { resourceId: buildResourceId(ids.resourceGroupName, ids.resourceName), newResourceName: newData.name })
        },
        {
            type: "custom_edit",
            key: "groupmove",
            title: "Move to another resource group",
            icon: "box-arrow-right",
            requestObject: async ids => ({ statusCode: 200, data: { name: ids.resourceGroupName }, rawBody: null }),
            schema: OpenAPISchema("ResourceGroupDTO"),
            updateResource: (ids, newData) => Use(APIService).resourceGroups._any_.resources.group.patch(ids.resourceGroupName, { resourceId: buildResourceId(ids.resourceGroupName, ids.resourceName), newResourceGroupName: newData.name })
        },
        {
            type: "delete",
            deleteResource: ids => Use(APIService).resourceGroups._any_.resources.delete(ids.resourceGroupName, { resourceId: buildResourceId(ids.resourceGroupName, ids.resourceName) })
        },
    ];
}

export function BuildResourceGeneralPageGroupEntry(buildResourceId: (resourceGroupName: string, resourceName: string) => string)
{
    return {
        displayName: "",
        entries: [
            BuildAccessControlViewModel(buildResourceId),
            BuildHealthViewModel(buildResourceId),
        ]
    };
}