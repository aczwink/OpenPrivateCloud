/**
 * OpenPrivateCloud
 * Copyright (C) 2023 Amir Czwink (amir130@hotmail.de)
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

import { ResourceHealthDTO } from "../../../dist/api";
import { APIService } from "../../Services/APIService";
import { IdBoundResourceAction } from "../../UI/IdBoundActions";
import { ObjectViewModel } from "../../UI/ViewModel";
import { BuildAccessControlPageEntry } from "./accesscontrol";

type ResourceAndGroupId = { resourceGroupName: string; resourceName: string };

function BuildHealthViewModel(buildResourceId: (resourceGroupName: string, resourceName: string) => string)
{
    const healthViewModel: ObjectViewModel<ResourceHealthDTO, ResourceAndGroupId> = {
        type: "object",
        actions: [],
        formTitle: _ => "Resource health",
        requestObject: (service, ids) => service.health.resource.get({ id: buildResourceId(ids.resourceGroupName, ids.resourceName) }),
        schemaName: "ResourceHealthDTO"
    };

    return healthViewModel;
}

export function BuildCommonResourceActions(buildResourceId: (resourceGroupName: string, resourceName: string) => string): IdBoundResourceAction<ResourceAndGroupId, any, APIService>[]
{
    return [
        {
            type: "custom_edit",
            key: "rename",
            title: "Rename",
            icon: "pen",
            propertiesSchemaName: "ResourceGroupDTO",
            requestObject: async (_, ids) => ({ statusCode: 200, data: { name: ids.resourceName }, rawBody: null }),
            updateResource: (service, ids, newData) => service.resourceGroups._any_.resources.name.patch(ids.resourceGroupName, { resourceId: buildResourceId(ids.resourceGroupName, ids.resourceName), newResourceName: newData.name })
        },
        {
            type: "custom_edit",
            key: "groupmove",
            title: "Move to another resource group",
            icon: "box-arrow-right",
            propertiesSchemaName: "ResourceGroupDTO",
            requestObject: async (_, ids) => ({ statusCode: 200, data: { name: ids.resourceGroupName }, rawBody: null }),
            updateResource: (service, ids, newData) => service.resourceGroups._any_.resources.group.patch(ids.resourceGroupName, { resourceId: buildResourceId(ids.resourceGroupName, ids.resourceName), newResourceGroupName: newData.name })
        },
        {
            type: "delete",
            deleteResource: (service, ids) => service.resourceGroups._any_.resources.delete(ids.resourceGroupName, { resourceId: buildResourceId(ids.resourceGroupName, ids.resourceName) })
        },
    ];
}

export function BuildResourceGeneralPageGroupEntry(buildResourceId: (resourceGroupName: string, resourceName: string) => string)
{
    return {
        displayName: "",
        entries: [
            BuildAccessControlPageEntry(buildResourceId),
            {
                child: BuildHealthViewModel(buildResourceId),
                displayName: "Health",
                key: "health"
            },
        ]
    };
}