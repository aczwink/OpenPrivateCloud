/**
 * OpenPrivateCloud
 * Copyright (C) 2019-2024 Amir Czwink (amir130@hotmail.de)
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
import { MembershipDataDto, PublicUserData, RoleAssignment, RoleDefinition, RolePermission, UserCreationData, UserGroup, UserGroupCreationData } from "../../dist/api";
import { APIService } from "../services/APIService";
import { Use } from "acfrontend";
import { APISchemaOf } from "../api-info";
import { ClusterLockedGuard } from "../ClusterLockedGuard";

type GroupIdRouteParams = { groupId: number };
type RoleIdRouteParams = { roleId: string };
type UserIdRouteParams = { userId: number };

const createUserRouteSetup: RouteSetup<{}, UserCreationData> = {
    content: {
        type: "create",
        call: (_ids, props) => Use(APIService).users.post(props),
        schema: APISchemaOf(x => x.UserCreationData),
    },
    displayText: "Create user",
    icon: "plus",
    routingKey: "create",
};

const userViewModel: RouteSetup<UserIdRouteParams, PublicUserData> = {
    content: {
        type: "object",
        actions: [
            {
                type: "edit",
                requestObject: (ids) => Use(APIService).users._any_.get(ids.userId),
                schema: APISchemaOf(x => x.EditableUserData),
                updateResource: (ids, props) => Use(APIService).users._any_.put(ids.userId, props),
            },
            {
                type: "delete",
                deleteResource: ids => Use(APIService).users._any_.delete(ids.userId),
            }
        ],
        formTitle: (_, user) => user.emailAddress,
        requestObject: ids => Use(APIService).users._any_.get(ids.userId),
        schema: APISchemaOf(x => x.PublicUserData),
    },
    displayText: "User",
    icon: "person",
    routingKey: "{userId}",
};


const usersViewModel: RouteSetup<{}, PublicUserData> = {
    content: {
        type: "collection",
        actions: [createUserRouteSetup],
        child: userViewModel,
        id: "id",
        requestObjects: _ => Use(APIService).users.get(),
        schema: APISchemaOf(x => x.PublicUserData)
    },
    displayText: "Users",
    icon: "person",
    routingKey: "users",
};

const createUserGroupRouteSetup: RouteSetup<{}, UserGroupCreationData> = {
    content: {
        type: "create",
        call: (_, group) => Use(APIService).usergroups.post(group),
        schema: APISchemaOf(x => x.UserGroupCreationData),
    },
    displayText: "Create user group",
    icon: "plus",
    routingKey: "create",
};

const userGroupOverviewViewModel: RouteSetup<GroupIdRouteParams, UserGroup> = {
    content: {
        type: "object",
        actions: [],
        formTitle: (_, x) => x.name,
        requestObject: ids => Use(APIService).usergroups._any_.get(ids.groupId),
        schema: APISchemaOf(x => x.UserGroup)
    },
    displayText: "Overview",
    icon: "binoculars",
    routingKey: "overview",
};

const createUserGroupMemberRouteSetup: RouteSetup<GroupIdRouteParams, MembershipDataDto> = {
    content: {
        type: "create",
        call: (ids, member) => Use(APIService).usergroups._any_.members.post(ids.groupId, member),
        schema: APISchemaOf(x => x.MembershipDataDto)
    },
    displayText: "Add member",
    icon: "plus",
    routingKey: "addmember",
};

const userGroupMemberViewModel: RouteSetup<GroupIdRouteParams & UserIdRouteParams, PublicUserData> = {
    content: {
        type: "object",
        actions: [
            {
                type: "delete",
                deleteResource: ids => Use(APIService).usergroups._any_.members.delete(ids.groupId, { userId: ids.userId }),
            }
        ],
        formTitle: (_, user) => user.emailAddress,
        requestObject: ids => Use(APIService).users._any_.get(ids.userId),
        schema: APISchemaOf(x => x.PublicUserData),
    },
    displayText: "Member",
    icon: "people",
    routingKey: "{userId}",
};

const userGroupMembersViewModel: RouteSetup<GroupIdRouteParams, PublicUserData> = {
    content: {
        type: "collection",
        actions: [createUserGroupMemberRouteSetup],
        child: userGroupMemberViewModel,
        id: "id",
        requestObjects: ids => Use(APIService).usergroups._any_.members.get(ids.groupId),
        schema: APISchemaOf(x => x.PublicUserData)
    },
    displayText: "Members",
    icon: "people",
    routingKey: "members",
};

const userGroupViewModel: RouteSetup<GroupIdRouteParams> = {
    content: {
        type: "multiPage",
        actions: [],
        entries: [
            {
                displayName: "",
                entries: [
                    userGroupOverviewViewModel,
                    userGroupMembersViewModel
                ]
            }
        ],
        formTitle: ids => "Group " + ids.groupId,
    },
    displayText: "User group",
    icon: "people",
    routingKey: "{groupId}",
};

const userGroupsViewModel: RouteSetup<{}, UserGroup> = {
    content: {
        type: "collection",
        actions: [createUserGroupRouteSetup],
        child: userGroupViewModel,
        id: "id",
        requestObjects: () => Use(APIService).usergroups.get(),
        schema: APISchemaOf(x => x.UserGroup),
    },
    displayText: "User groups",
    icon: "people",
    routingKey: "groups",
};

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

export const usersAndGroupsRoute: RouteSetup = {
    content: {
        type: "multiPage",
        actions: [],
        entries: [
            {
                displayName: "",
                entries: [
                    usersViewModel,
                    userGroupsViewModel,
                    rolesViewModel,
                    clusterRoleAssignmentsViewModel
                ]
            }
        ],
        formTitle: _ => "Users and groups management",
    },
    displayText: "IAM",
    guards: [ClusterLockedGuard, AuthGuard],
    icon: "people-fill",
    routingKey: "usersandgroups",
};