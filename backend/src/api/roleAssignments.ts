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

import { APIController, Auth, Body, Common, Delete, Forbidden, Get, NotFound, Post, Query } from "acts-util-apilib";
import { RoleAssignment, RoleAssignmentsController } from "../data-access/RoleAssignmentsController";
import { PermissionsManager } from "../services/PermissionsManager";
import { ResourceProviderManager } from "../services/ResourceProviderManager";
import { ResourcesManager } from "../services/ResourcesManager";
import { ResourceReferenceWithSession } from "../common/ResourceReference";
import { permissions } from "openprivatecloud-common";
import { AccessToken } from "../api_security";
import { UsersManager } from "../services/UsersManager";

 
@APIController("roleAssignments")
class RoleAssignmentsAPIController
{
    constructor(private roleAssignmentsController: RoleAssignmentsController, private permissionsManager: PermissionsManager, private usersManager: UsersManager)
    {
    }

    @Post()
    public async AddClusterRoleAssignment(
        @Body roleAssignment: RoleAssignment,
        @Auth("jwt") accessToken: AccessToken
    )
    {
        const opcUserId = await this.usersManager.MapOAuth2SubjectToOPCUserId(accessToken.sub);
        const canWriteData = await this.permissionsManager.HasUserClusterWidePermission(opcUserId, permissions.roleAssignments.write);
        if(!canWriteData)
            return Forbidden("write access to role assignments denied");

        await this.roleAssignmentsController.AddClusterRoleAssignment(roleAssignment);
    }

    @Delete()
    public async DeleteClusterRoleAssignment(
        @Body roleAssignment: RoleAssignment,
        @Auth("jwt") accessToken: AccessToken
    )
    {
        const opcUserId = await this.usersManager.MapOAuth2SubjectToOPCUserId(accessToken.sub);
        const canWriteData = await this.permissionsManager.HasUserClusterWidePermission(opcUserId, permissions.roleAssignments.write);
        if(!canWriteData)
            return Forbidden("delete access to role assignments denied");

        await this.roleAssignmentsController.DeleteClusterRoleAssignment(roleAssignment);
    }

    @Get()
    public async RequestClusterRoleAssignments()
    {
        return await this.roleAssignmentsController.QueryAllClusterRoleAssignments();
    }
}

@APIController("roleAssignments/instance")
class _api2_
{
    constructor(private roleAssignmentsController: RoleAssignmentsController, private permissionsManager: PermissionsManager,
        private resourceProviderManager: ResourceProviderManager, private resourcesManager: ResourcesManager, private usersManager: UsersManager)
    {
    }

    @Common()
    public async ExtractCommonAPIData(
        @Query resourceId: string,
        @Auth("jwt") accessToken: AccessToken
    )
    {
        const ref = await this.resourcesManager.CreateResourceReferenceFromExternalId(resourceId);
        if(ref === undefined)
            return NotFound("resource not found");

        const res: ResourceReferenceWithSession = {
            resourceReference: ref,
            opcUserId: await this.usersManager.MapOAuth2SubjectToOPCUserId(accessToken.sub)
        }
        return res;
    }

    @Post()
    public async Add(
        @Common context: ResourceReferenceWithSession,
        @Body roleAssignment: RoleAssignment
    )
    {
        const canWriteData = await this.permissionsManager.HasUserPermissionOnResourceScope(context.resourceReference, context.opcUserId, permissions.roleAssignments.write);
        if(!canWriteData)
            return Forbidden("write access to role assignments denied");

        await this.permissionsManager.AddResourceLevelRoleAssignment(context.resourceReference.id, roleAssignment);
        await this.resourceProviderManager.ResourcePermissionsChanged(context.resourceReference);
    }

    @Delete()
    public async Delete(
        @Common context: ResourceReferenceWithSession,
        @Body roleAssignment: RoleAssignment
    )
    {
        const canWriteData = await this.permissionsManager.HasUserPermissionOnResourceScope(context.resourceReference, context.opcUserId, permissions.roleAssignments.write);
        if(!canWriteData)
            return Forbidden("delete access to role assignments denied");

        await this.permissionsManager.DeleteResourceLevelRoleAssignment(context.resourceReference.id, roleAssignment);
        await this.resourceProviderManager.ResourcePermissionsChanged(context.resourceReference);
    }

    @Get()
    public async RequestInstanceRoleAssignments(
        @Common context: ResourceReferenceWithSession
    )
    {
        return await this.roleAssignmentsController.QueryResourceLevelRoleAssignments(context.resourceReference.id);
    }
}