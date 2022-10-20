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

import { APIController, Body, Delete, Get, Path, Post } from "acts-util-apilib";
import { UserGroupsController } from "../data-access/UserGroupsController";
import { UsersController } from "../data-access/UsersController";
import { UserGroupsManager } from "../services/UserGroupsManager";

interface UserGroupCreationData
{
    name: string;
}

interface MembershipDataDto
{
    /**
     * @title Member
     * @format user
     */
    userId: number;
}

@APIController("usergroups")
class UserGroupsAPIController
{
    constructor(private userGroupsController: UserGroupsController)
    {
    }

    @Post()
    public async Create(
        @Body data: UserGroupCreationData
    )
    {
        return await this.userGroupsController.CreateGroup(data.name);
    }

    @Get()
    public async RequestUserGroups()
    {
        return await this.userGroupsController.QueryUserGroups();
    }
}

@APIController("usergroups/{userGroupId}")
class UserGroupAPIController
{
    constructor(private userGroupsController: UserGroupsController)
    {
    }

    @Get()
    public async RequestUserGroup(
        @Path userGroupId: number
    )
    {
        return await this.userGroupsController.QueryUserGroup(userGroupId);
    }
}

@APIController("usergroups/{userGroupId}/members")
class UserGroupMembersAPIController
{
    constructor(private usersController: UsersController, private userGroupsManager: UserGroupsManager)
    {
    }

    @Post()
    public async Create(
        @Path userGroupId: number,
        @Body data: MembershipDataDto
    )
    {
        return await this.userGroupsManager.AddMember(userGroupId, data.userId);
    }

    @Delete()
    public async RemoveMember(
        @Path userGroupId: number,
        @Body data: MembershipDataDto
    )
    {
        return await this.userGroupsManager.RemoveMembership(userGroupId, data.userId);
    }

    @Get()
    public async RequestMembers(
        @Path userGroupId: number
    )
    {
        return await this.usersController.QueryMembersOfGroup(userGroupId);
    }
}