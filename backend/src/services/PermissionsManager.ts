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
import { Injectable } from "acts-util-node";
import { ResourcesController } from "../data-access/ResourcesController";
import { PermissionsController } from "../data-access/PermissionsController";
import { RoleAssignment, RoleAssignmentsController } from "../data-access/RoleAssignmentsController";
import { HostUsersManager } from "./HostUsersManager";
import { ResourceReference } from "../common/ResourceReference";
  
@Injectable
export class PermissionsManager
{
    constructor(private instancesController: ResourcesController, private permissionsController: PermissionsController, private hostUsersManager: HostUsersManager,
        private roleAssignmentsController: RoleAssignmentsController)
    {
    }
    
    //Public methods
    public async AddInstanceRoleAssignment(instanceId: number, roleAssignment: RoleAssignment)
    {
        const hostId = await this.instancesController.QueryHostIdOfInstance(instanceId);
        const userGroupIds = await this.permissionsController.QueryGroupsAssociatedWithHost(hostId!);

        await this.roleAssignmentsController.AddInstanceRoleAssignment(instanceId, roleAssignment);

        if(!userGroupIds.has(roleAssignment.userGroupId))
            await this.hostUsersManager.SyncGroupToHost(hostId!, roleAssignment.userGroupId);
    }

    public async DeleteInstanceRoleAssignment(instanceId: number, roleAssignment: RoleAssignment)
    {        
        await this.roleAssignmentsController.DeleteInstanceRoleAssignment(instanceId, roleAssignment);

        const hostId = await this.instancesController.QueryHostIdOfInstance(instanceId);
        const userGroupIds = await this.permissionsController.QueryGroupsAssociatedWithHost(hostId!);

        if(!userGroupIds.has(roleAssignment.userGroupId))
            await this.hostUsersManager.RemoveGroupFromHost(hostId!, roleAssignment.userGroupId);
    }

    public async HasUserPermissionOnResourceScope(resourceReference: ResourceReference, userId: number, permission: string)
    {
        const clusterWide = await this.permissionsController.HasUserClusterWidePermission(userId, permission);
        if(clusterWide)
            return true;

        //TODO: RG level

        const resourceLevel = await this.permissionsController.HasUserResourceLevelPermission(resourceReference.id, userId, permission);
        return resourceLevel;
    }
}