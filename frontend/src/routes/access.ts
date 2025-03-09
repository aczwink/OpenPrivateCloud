/**
 * OpenPrivateCloud
 * Copyright (C) 2019-2025 Amir Czwink (amir130@hotmail.de)
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
import { RoleAssignment, RoleDefinition, RolePermission } from "../../dist/api";
import { APIService } from "../services/APIService";
import { Use } from "acfrontend";
import { APISchemaOf } from "../api-info";

type RoleIdRouteParams = { roleId: string };

const roleOverviewViewModel: RouteSetup<RoleIdRouteParams, RoleDefinition> = {
    content: {
        type: "object",
        actions: [],
        formTitle: (_, role) => role.name,
        requestObject: ids =>  Use(APIService).roles._any_.get(ids.roleId),
        schema: APISchemaOf(x => x.RoleDefinition),
    },
    displayText: "Overview",
    icon: "binoculars",
    routingKey: "overview",
};

const permissionsViewModel: RouteSetup<RoleIdRouteParams, RolePermission> = {
    content: {
        type: "list",
        requestObjects: ids => Use(APIService).roles._any_.permissions.get(ids.roleId),
        schema: APISchemaOf(x => x.RolePermission),
    },
    displayText: "Permissions",
    icon: "universal-access",
    routingKey: "permissions",
};

const roleViewModel: RouteSetup<RoleIdRouteParams> = {
    content: {
        type: "multiPage",
        actions: [],
        entries: [
            {
                displayName: "",
                entries: [
                    roleOverviewViewModel,
                    permissionsViewModel
                ]
            }
        ],
        formTitle: x => "Role: " + x.roleId,
    },
    displayText: "Role",
    icon: "person-rolodex",
    routingKey: "{roleId}",
};

const rolesViewModel: RouteSetup<{}, RoleDefinition> = {
    content: {
        type: "collection",
        child: roleViewModel,
        id: "id",
        requestObjects: _ => Use(APIService).roles.get({filter: ""}),
        schema: APISchemaOf(x => x.RoleDefinition)
    },
    displayText: "Roles",
    icon: "person-rolodex",
    routingKey: "roles",
};

const createClusterLevelRoleAssignmentRouteSetup: RouteSetup<{}, RoleAssignment> = {
    content: {
        type: "create",
        call: (_, roleAssignment) => Use(APIService).roleAssignments.post(roleAssignment),
        schema: APISchemaOf(x => x.RoleAssignment)
    },
    displayText: "Create cluster-level role assignment",
    icon: "plus",
    routingKey: "create",
};

const clusterRoleAssignmentsViewModel: RouteSetup<{}, RoleAssignment> = {
    content: {
        type: "list",
        actions: [createClusterLevelRoleAssignmentRouteSetup],
        boundActions: [
            {
                type: "delete",
                deleteResource: (_, obj) => Use(APIService).roleAssignments.delete(obj),
            }
        ],
        requestObjects: _ => Use(APIService).roleAssignments.get(),
        schema: APISchemaOf(x => x.RoleAssignment),
    },
    displayText: "Cluster-level role assignments",
    icon: "lock-fill",
    routingKey: "clusteraccess"
};

export const accessRoute: RouteSetup = {
    content: {
        type: "multiPage",
        actions: [],
        entries: [
            {
                displayName: "",
                entries: [
                    rolesViewModel,
                    clusterRoleAssignmentsViewModel
                ]
            }
        ],
        formTitle: _ => "Access management",
    },
    displayText: "Access management",
    icon: "person-fill-lock",
    requiredScopes: ["admin"],
    routingKey: "usersandgroups",
};