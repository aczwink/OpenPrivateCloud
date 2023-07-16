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

import { APIController, Body, Common, Delete, Get, NotFound, Post, Query } from "acts-util-apilib";
import { ResourcesController } from "../data-access/ResourcesController";
import { RoleAssignment, RoleAssignmentsController } from "../data-access/RoleAssignmentsController";
import { PermissionsManager } from "../services/PermissionsManager";
import { ResourceProviderManager } from "../services/ResourceProviderManager";
import { ResourcesManager } from "../services/ResourcesManager";
import { ResourceReference } from "../common/InstanceReference";

 
@APIController("roleAssignments")
class RoleAssignmentsAPIController
{
    constructor(private roleAssignmentsController: RoleAssignmentsController)
    {
    }

    @Post()
    public async AddClusterRoleAssignment(
        @Body roleAssignment: RoleAssignment
    )
    {
        await this.roleAssignmentsController.AddClusterRoleAssignment(roleAssignment);
    }

    @Delete()
    public async DeleteClusterRoleAssignment(
        @Body roleAssignment: RoleAssignment
    )
    {
        await this.roleAssignmentsController.DeleteClusterRoleAssignment(roleAssignment);
    }

    @Get()
    public async RequestClusterRoleAssignments()
    {
        return await this.roleAssignmentsController.QueryAllClusterRoleAssignments();
    }
}

@APIController("roleAssignments/instance")
class InstanceRoleAssignmentsAPIController
{
    constructor(private roleAssignmentsController: RoleAssignmentsController, private permissionsManager: PermissionsManager,
        private resourceProviderManager: ResourceProviderManager, private instancesController: ResourcesController, private resourcesManager: ResourcesManager)
    {
    }

    @Common()
    public async FetchResourceReference(
        @Query resourceId: string,
    )
    {
        const ref = await this.resourcesManager.CreateResourceReferenceFromExternalId(resourceId);
        if(ref === undefined)
            return NotFound("resource not found");

        return ref;
    }

    @Post()
    public async Add(
        @Common resourceReference: ResourceReference,
        @Body roleAssignment: RoleAssignment
    )
    {
        await this.permissionsManager.AddInstanceRoleAssignment(resourceReference.id, roleAssignment);
        await this.resourceProviderManager.InstancePermissionsChanged(resourceReference);
    }

    @Delete()
    public async Delete(
        @Common resourceReference: ResourceReference,
        @Body roleAssignment: RoleAssignment
    )
    {
        await this.permissionsManager.DeleteInstanceRoleAssignment(resourceReference.id, roleAssignment);
        await this.resourceProviderManager.InstancePermissionsChanged(resourceReference);
    }

    @Get()
    public async RequestInstanceRoleAssignments(
        @Common resourceReference: ResourceReference
    )
    {
        return await this.roleAssignmentsController.QueryResourceLevelRoleAssignments(resourceReference.id);
    }
}