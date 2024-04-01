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
import { Injectable } from "acts-util-node";
import { ResourcesController } from "../data-access/ResourcesController";
import { PermissionsController } from "../data-access/PermissionsController";
import { RoleAssignment, RoleAssignmentsController } from "../data-access/RoleAssignmentsController";
import { HostUsersManager } from "./HostUsersManager";
import { ResourceReference } from "../common/ResourceReference";
import { UsersController } from "../data-access/UsersController";
  
@Injectable
export class PermissionsManager
{
    constructor(private resourcesController: ResourcesController, private permissionsController: PermissionsController, private hostUsersManager: HostUsersManager,
        private roleAssignmentsController: RoleAssignmentsController, private usersController: UsersController)
    {
    }
    
    //Public methods
    public async AddInstanceRoleAssignment(instanceId: number, roleAssignment: RoleAssignment)
    {
        const hostId = await this.resourcesController.QueryHostIdOfInstance(instanceId);
        const userGroupIds = await this.permissionsController.QueryGroupsAssociatedWithHost(hostId!);

        await this.roleAssignmentsController.AddInstanceRoleAssignment(instanceId, roleAssignment);

        if(!userGroupIds.has(roleAssignment.userGroupId))
            await this.hostUsersManager.SyncGroupToHost(hostId!, roleAssignment.userGroupId);
    }

    public async DeleteInstanceRoleAssignment(instanceId: number, roleAssignment: RoleAssignment)
    {        
        await this.roleAssignmentsController.DeleteInstanceRoleAssignment(instanceId, roleAssignment);

        const hostId = await this.resourcesController.QueryHostIdOfInstance(instanceId);
        const userGroupIds = await this.permissionsController.QueryGroupsAssociatedWithHost(hostId!);

        if(!userGroupIds.has(roleAssignment.userGroupId))
            await this.hostUsersManager.RemoveGroupFromHost(hostId!, roleAssignment.userGroupId);
    }

    public async HasUserClusterWidePermission(userId: number, permission: string)
    {
        return await this.permissionsController.HasUserClusterWidePermission(userId, permission);
    }

    public async HasUserPermissionOnResourceGroupScope(resourceGroupId: number, userId: number, permission: string)
    {
        const rgLevel = await this.permissionsController.HasUserResourceGroupLevelPermission(resourceGroupId, userId, permission);
        if(rgLevel)
            return true;
        
        return this.HasUserClusterWidePermission(userId, permission);
    }

    public async HasUserPermissionOnResourceScope(resourceReference: ResourceReference, userId: number, permission: string)
    {
        const resourceLevel = await this.permissionsController.HasUserResourceLevelPermission(resourceReference.id, userId, permission);
        if(resourceLevel)
            return true;

        const resource = await this.resourcesController.QueryResource(resourceReference.id);
        if(resource === undefined)
            throw new Error("TODO: implement me");

        return this.HasUserPermissionOnResourceGroupScope(resource.instanceGroupId, userId, permission);
    }

    public async QueryUsersWithPermission(resourceId: number, permission: string)
    {
        //TODO: cluster level
        //TODO: RG level
        const groupIds = await this.permissionsController.QueryGroupsWithPermission(resourceId, permission);
        const members = await groupIds.Map(groupId => this.usersController.QueryMembersOfGroup(groupId)).PromiseAll();
        
        return members.Values()
            .Map(x => x.Values()).Flatten()
            .Map(x => x.id)
            .ToSet();
    }
}