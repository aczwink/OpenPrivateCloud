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

import { APIController, Body, Delete, Get, NotFound, Post, Query } from "acts-util-apilib";
import { InstancesController } from "../data-access/InstancesController";
import { RoleAssignment, RoleAssignmentsController } from "../data-access/RoleAssignmentsController";
import { PermissionsManager } from "../services/PermissionsManager";
import { ResourceProviderManager } from "../services/ResourceProviderManager";

 
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
        private resourceProviderManager: ResourceProviderManager, private instancesController: InstancesController)
    {
    }

    @Post()
    public async Add(
        @Query fullInstanceName: string,
        @Body roleAssignment: RoleAssignment
    )
    {
        const instance = await this.instancesController.QueryInstance(fullInstanceName);
        if(instance === undefined)
            return NotFound("instance not found");

        await this.permissionsManager.AddInstanceRoleAssignment(instance.id, roleAssignment);
        await this.resourceProviderManager.InstancePermissionsChanged(fullInstanceName);
    }

    @Delete()
    public async Delete(
        @Query fullInstanceName: string,
        @Body roleAssignment: RoleAssignment
    )
    {
        const instance = await this.instancesController.QueryInstance(fullInstanceName);
        if(instance === undefined)
            return NotFound("instance not found");

        await this.permissionsManager.DeleteInstanceRoleAssignment(instance.id, roleAssignment);
        await this.resourceProviderManager.InstancePermissionsChanged(fullInstanceName);
    }

    @Get()
    public async RequestInstanceRoleAssignments(
        @Query fullInstanceName: string
    )
    {
        return await this.roleAssignmentsController.QueryInstanceRoleAssignments(fullInstanceName);
    }
}