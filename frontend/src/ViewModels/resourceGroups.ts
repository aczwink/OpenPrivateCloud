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

import { ResourceGroupDTO, RoleAssignment } from "../../dist/api";
import { ListViewModel } from "../UI/ListViewModel";
import { CollectionViewModel, MultiPageViewModel, RoutingViewModel } from "../UI/ViewModel";
import { CreateResourceComponent } from "../Views/resources/CreateResourceComponent";
import { ResourceListComponent } from "../Views/resources/ResourceListComponent";
import { resourcesRoutes } from "./resources";

type ResourceGroupId = { resourceGroupName: string };

const groupRouting: RoutingViewModel = {
    type: "routing",
    entries: [
        ...resourcesRoutes.entries,
        {
            key: "add",
            viewModel: {
                type: "component",
                component: CreateResourceComponent,
            }
        },
        {
            key: "",
            viewModel: {
                type: "component",
                component: ResourceListComponent,
            }
        }
    ]
};

const accessControlViewModel: ListViewModel<RoleAssignment, ResourceGroupId> = {
    actions: [
        {
            type: "create",
            createResource: (service, ids, roleAssignment) => service.resourceGroups._any_.roleAssignments.post(ids.resourceGroupName, roleAssignment)
        }
    ],
    boundActions: [
        {
            type: "delete",
            deleteResource: (service, ids, roleAssignment) => service.resourceGroups._any_.roleAssignments.delete(ids.resourceGroupName, roleAssignment)
        }
    ],
    displayName: "Access control",
    requestObjects: (service, ids) => service.resourceGroups._any_.roleAssignments.get(ids.resourceGroupName),
    schemaName: "RoleAssignment",
    type: "list",
};

const groupViewModel: MultiPageViewModel<ResourceGroupId> = {
    type: "multiPage",
    actions: [
        {
            type: "delete",
            deleteResource: (service, ids) => service.resourceGroups._any_.delete(ids.resourceGroupName)
        }
    ],
    entries: [
        {
            displayName: "",
            entries: [
                {
                    key: "resources",
                    child: groupRouting,
                    displayName: "Resources"
                },
                {
                    key: "access",
                    displayName: "Access control",
                    child: accessControlViewModel,
                }
            ]
        }
    ],
    formTitle: ids => "Resource group: " + ids.resourceGroupName
};

const groupsViewModel: CollectionViewModel<ResourceGroupDTO, {}> = {
    type: "collection",
    actions: [
        {
            type: "create",
            createResource: (service, _, data) => service.resourceGroups.post(data),
        }
    ],
    child: groupViewModel,
    displayName: "Resource groups",
    extractId: group => group.name,
    idKey: "resourceGroupName",
    requestObjects: service => service.resourceGroups.get(),
    schemaName: "ResourceGroupDTO",
};

const root: RoutingViewModel = {
    type: "routing",
    entries: [
        {
            key: "resourceGroups",
            viewModel: groupsViewModel,
        }
    ]
}

export default root;