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

import { MembershipDataDto, PublicUserData, UserCreationData, UserGroup, UserGroupCreationData } from "../../dist/api";
import { APIService } from "../Services/APIService";
import { CollectionViewModel, MultiPageViewModel, ObjectViewModel, RoutingViewModel } from "../UI/ViewModel";

type UserIdRouteParams = { userId: number };

const userViewModel: ObjectViewModel<PublicUserData, UserIdRouteParams, APIService> = {
    actions: [],
    formTitle: user => user.emailAddress,
    requestObject: async (service, ids) => {
        const response = await service.users._any_.get(ids.userId);
        if(response.statusCode !== 200)
            throw new Error("todo implement me");
        return response.data;
    },
    schemaName: "PublicUserData",
    service: APIService,
    type: "object"
};

const usersViewModel: CollectionViewModel<PublicUserData, {}, APIService, UserCreationData> = {
    actions: [
        {
            type: "create",
            createResource: async (service, _ids, props) => {
                await service.users.post(props);
            },
            schemaName: "UserCreationData"
        }
    ],
    child: userViewModel,
    displayName: "Users",
    extractId: user => user.id,
    idKey: "userId",
    requestObjects: async service => (await service.users.get()).data,
    schemaName: "PublicUserData",
    service: APIService,
    type: "collection"
};

type GroupIdRouteParams = { groupId: number };

const userGroupOverviewViewModel: ObjectViewModel<UserGroup, GroupIdRouteParams, APIService> = {
    actions: [],
    formTitle: x => x.name,
    requestObject: async (service, ids) => {
        const result = await service.usergroups._any_.get(ids.groupId)
        if(result.statusCode !== 200)
            throw new Error("TODO: implement me");
        return result.data;
    },
    schemaName: "UserGroup",
    service: APIService,
    type: "object"
};

const userGroupMemberViewModel: ObjectViewModel<PublicUserData, GroupIdRouteParams & UserIdRouteParams, APIService> = {
    actions: [
        {
            type: "delete",
            deleteResource: async (service, ids) => {
                await service.usergroups._any_.members.delete(ids.groupId, { userId: ids.userId })
            },
        }
    ],
    formTitle: user => user.emailAddress,
    requestObject: async (service, ids) => {
        const response = await service.users._any_.get(ids.userId);
        if(response.statusCode !== 200)
            throw new Error("todo implement me");
        return response.data;
    },
    schemaName: "PublicUserData",
    service: APIService,
    type: "object"
};

const userGroupMembersViewModel: CollectionViewModel<PublicUserData, GroupIdRouteParams, APIService, MembershipDataDto> = {
    actions: [
        {
            type: "create",
            createResource: async (service, ids, member) => {
                await service.usergroups._any_.members.post(ids.groupId, member)
            },
            schemaName: "MembershipDataDto",
        }
    ],
    child: userGroupMemberViewModel,
    displayName: "Members",
    extractId: x => x.id,
    idKey: "userId",
    requestObjects: async (service, ids) => (await service.usergroups._any_.members.get(ids.groupId)).data,
    schemaName: "PublicUserData",
    service: APIService,
    type: "collection",
};

const userGroupViewModel: MultiPageViewModel<GroupIdRouteParams, APIService> = {
    actions: [],
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
    ],
    formTitle: ids => "Group " + ids.groupId,
    service: APIService,
    type: "multiPage"
};

const userGroupsViewModel: CollectionViewModel<UserGroup, {}, APIService, UserGroupCreationData> = {
    actions: [
        {
            type: "create",
            createResource: async (service, _, group) => {
                await service.usergroups.post(group);
            },
            schemaName: "UserGroupCreationData"
        }
    ],
    child: userGroupViewModel,
    displayName: "User groups",
    extractId: x => x.id,
    idKey: "groupId",
    requestObjects: async (service, _) => (await service.usergroups.get()).data,
    schemaName: "UserGroup",
    service: APIService,
    type: "collection",
};

const usersAndGroupsViewModel: MultiPageViewModel<{}, APIService> = {
    type: "multiPage",
    actions: [],
    entries: [
        {
            child: usersViewModel,
            displayName: "Users",
            key: "users",
        },
        {
            child: userGroupsViewModel,
            displayName: "Groups",
            key: "groups"
        }
    ],
    formTitle: _ => "Users and groups management",
    service: APIService,
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