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

import { MembershipDataDto, PublicUserData, RoleAssignment, UserCreationData, UserGroup, UserGroupCreationData } from "../../dist/api";
import { ListViewModel } from "../UI/ListViewModel";
import { CollectionViewModel, MultiPageViewModel, ObjectViewModel, RoutingViewModel } from "../UI/ViewModel";

type UserIdRouteParams = { userId: number };

const userViewModel: ObjectViewModel<PublicUserData, UserIdRouteParams> = {
    actions: [],
    formTitle: user => user.emailAddress,
    requestObject: (service, ids) => service.users._any_.get(ids.userId),
    schemaName: "PublicUserData",
    type: "object"
};

const usersViewModel: CollectionViewModel<PublicUserData, {}, UserCreationData> = {
    actions: [
        {
            type: "create",
            createResource: (service, _ids, props) => service.users.post(props),
            schemaName: "UserCreationData"
        }
    ],
    child: userViewModel,
    displayName: "Users",
    extractId: user => user.id,
    idKey: "userId",
    requestObjects: service => service.users.get(),
    schemaName: "PublicUserData",
    type: "collection"
};

type GroupIdRouteParams = { groupId: number };

const userGroupOverviewViewModel: ObjectViewModel<UserGroup, GroupIdRouteParams> = {
    actions: [],
    formTitle: x => x.name,
    requestObject: (service, ids) => service.usergroups._any_.get(ids.groupId),
    schemaName: "UserGroup",
    type: "object"
};

const userGroupMemberViewModel: ObjectViewModel<PublicUserData, GroupIdRouteParams & UserIdRouteParams> = {
    actions: [
        {
            type: "delete",
            deleteResource: (service, ids) => service.usergroups._any_.members.delete(ids.groupId, { userId: ids.userId }),
        }
    ],
    formTitle: user => user.emailAddress,
    requestObject: (service, ids) => service.users._any_.get(ids.userId),
    schemaName: "PublicUserData",
    type: "object"
};

const userGroupMembersViewModel: CollectionViewModel<PublicUserData, GroupIdRouteParams, MembershipDataDto> = {
    actions: [
        {
            type: "create",
            createResource: async (service, ids, member) => service.usergroups._any_.members.post(ids.groupId, member),
            schemaName: "MembershipDataDto",
        }
    ],
    child: userGroupMemberViewModel,
    displayName: "Members",
    extractId: x => x.id,
    idKey: "userId",
    requestObjects: (service, ids) => service.usergroups._any_.members.get(ids.groupId),
    schemaName: "PublicUserData",
    type: "collection",
};

const userGroupViewModel: MultiPageViewModel<GroupIdRouteParams> = {
    actions: [],
    entries: [
        {
            displayName: "",
            entries: [
                {
                    child: userGroupOverviewViewModel,
                    displayName: "Overview",
                    key: "overview"
                },
                {
                    child: userGroupMembersViewModel,
                    displayName: "Members",
                    key: "members"
                }
            ]
        }
    ],
    formTitle: ids => "Group " + ids.groupId,
    type: "multiPage"
};

const userGroupsViewModel: CollectionViewModel<UserGroup, {}, UserGroupCreationData> = {
    actions: [
        {
            type: "create",
            createResource: (service, _, group) => service.usergroups.post(group),
            schemaName: "UserGroupCreationData"
        }
    ],
    child: userGroupViewModel,
    displayName: "User groups",
    extractId: x => x.id,
    idKey: "groupId",
    requestObjects: (service, _) => service.usergroups.get(),
    schemaName: "UserGroup",
    type: "collection",
};

const clusterRoleAssignmentsViewModel: ListViewModel<RoleAssignment, {}> = {
    type: "list",
    actions: [
        {
            type: "create",
            createResource: (service, _, roleAssignment) => service.roleAssignments.post(roleAssignment),
        }
    ],
    boundActions: [
        {
            type: "delete",
            deleteResource: (service, _, obj) => service.roleAssignments.delete(obj),
        }
    ],
    displayName: "Cluster-level role assignments",
    requestObjects: (service, _) => service.roleAssignments.get(),
    schemaName: "RoleAssignment"
};

const usersAndGroupsViewModel: MultiPageViewModel<{}> = {
    type: "multiPage",
    actions: [],
    entries: [
        {
            displayName: "",
            entries: [
                {
                    child: usersViewModel,
                    displayName: "Users",
                    key: "users",
                    icon: {
                        type: "bootstrap",
                        name: "person"
                    }
                },
                {
                    child: userGroupsViewModel,
                    displayName: "Groups",
                    key: "groups",
                    icon: {
                        type: "bootstrap",
                        name: "people"
                    }
                },
                {
                    child: clusterRoleAssignmentsViewModel,
                    displayName: "Cluster access control",
                    key: "clusteraccess",
                    icon: {
                        type: "bootstrap",
                        name: "lock-fill"
                    }
                }
            ]
        }
    ],
    formTitle: _ => "Users and groups management",
};

const root: RoutingViewModel = {
    type: "routing",
    entries: [
        {
            key: "usersandgroups",
            viewModel: usersAndGroupsViewModel,
        }
    ]
}

export default root;