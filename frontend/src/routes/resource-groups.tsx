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

import { RouteSetup } from "acfrontendex";
import { AuthGuard } from "../AuthGuard";
import { JSX_CreateElement, Use } from "acfrontend";
import { APIService } from "../services/APIService";
import { ResourceGroupDTO, RoleAssignment } from "../../dist/api";
import { APISchemaOf } from "../api-info";
import { ResourceListComponent } from "../components/resources/ResourceListComponent";
import { CreateResourceComponent } from "../components/resources/CreateResourceComponent";
import { resourceTypesRoutes } from "./resources";
import { ClusterLockedGuard } from "../ClusterLockedGuard";

type ResourceGroupId = { resourceGroupName: string };

const createResourceGroupRoute: RouteSetup<{}, ResourceGroupDTO> = {
    content: {
        type: "create",
        call: (_, data) => Use(APIService).resourceGroups.post(data),
        schema: APISchemaOf(x => x.ResourceGroupDTO),
    },
    displayText: "Create resource group",
    icon: "plus",
    routingKey: "create",
};

const groupRouting: RouteSetup = {
    content: {
        type: "routing",
        entries: [
            ...resourceTypesRoutes,
            {
                content: {
                    type: "component",
                    component: CreateResourceComponent
                },
                displayText: "Create resource",
                icon: "plus",
                routingKey: "add",
            },
            {
                content: {
                    type: "element",
                    element: ids => <ResourceListComponent query={apiService => apiService.resourceGroups._any_.resources.get(ids.resourceGroupName)} />
                },
                displayText: "Show resources",
                icon: "collection",
                routingKey: "",
            }
        ]
    },
    displayText: "Resources",
    icon: "collection",
    routingKey: "resources",
};

const createRoleAssignmentRoute: RouteSetup<ResourceGroupId, RoleAssignment> = {
    content: {
        type: "create",
        call: (ids, roleAssignment) => Use(APIService).resourceGroups._any_.roleAssignments.post(ids.resourceGroupName, roleAssignment),
        schema: APISchemaOf(x => x.RoleAssignment),
    },
    displayText: "Create role assignment",
    icon: "plus",
    routingKey: "create",
};

const accessControlViewModel: RouteSetup<ResourceGroupId, RoleAssignment> = {
    content: {
        type: "list",
        actions: [
            createRoleAssignmentRoute,
        ],
        boundActions: [
            {
                type: "delete",
                deleteResource: (ids, roleAssignment) => Use(APIService).resourceGroups._any_.roleAssignments.delete(ids.resourceGroupName, roleAssignment)
            }
        ],
        requestObjects: ids => Use(APIService).resourceGroups._any_.roleAssignments.get(ids.resourceGroupName),
        schema: APISchemaOf(x => x.RoleAssignment)
    },
    displayText: "Access control",
    icon: "lock-fill",
    routingKey: "access",
};

const groupViewModel: RouteSetup<ResourceGroupId> = {
    content: {
        type: "multiPage",
        actions: [
            {
                type: "edit",
                requestObject: (ids) => Use(APIService).resourceGroups._any_.get(ids.resourceGroupName),
                schema: APISchemaOf(x => x.ResourceGroupDTO),
                updateResource: (ids, newData) => Use(APIService).resourceGroups._any_.patch(ids.resourceGroupName, { newResourceGroupName: newData.name })
            },
            {
                type: "delete",
                deleteResource: ids => Use(APIService).resourceGroups._any_.delete(ids.resourceGroupName)
            }
        ],
        entries: [
            {
                displayName: "",
                entries: [
                    groupRouting,
                    accessControlViewModel,
                ]
            }
        ],
        formTitle: ids => "Resource group: " + ids.resourceGroupName
    },
    displayText: "Resource group",
    icon: "collection-fill",
    routingKey: "{resourceGroupName}",
};

export const resourceGroupsRoute: RouteSetup<{}, ResourceGroupDTO> = {
    content: {
        type: "collection",
        actions: [createResourceGroupRoute],
        child: groupViewModel,
        id: "name",
        requestObjects: _ => Use(APIService).resourceGroups.get(),
        schema: APISchemaOf(x => x.ResourceGroupDTO),
    },
    displayText: "Resource groups",
    guards: [ClusterLockedGuard, AuthGuard],
    icon: "collection-fill",
    routingKey: "resourcegroups",
};