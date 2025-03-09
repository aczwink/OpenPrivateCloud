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
import { Injectable } from "acts-util-node";
import { ResourcesController } from "../data-access/ResourcesController";
import { PermissionsController } from "../data-access/PermissionsController";
import { RoleAssignment, RoleAssignmentsController } from "../data-access/RoleAssignmentsController";
import { ResourceReference } from "../common/ResourceReference";
import { ResourcesManager } from "./ResourcesManager";
import { ResourceProviderManager } from "./ResourceProviderManager";
import { UsersManager } from "./UsersManager";
import { permissions } from "openprivatecloud-common";
import { EnumeratorBuilder } from "acts-util-core";
import { ResourceGroupsController } from "../data-access/ResourceGroupsController";
  
@Injectable
export class PermissionsManager
{
    constructor(private resourcesController: ResourcesController, private permissionsController: PermissionsController,
        private roleAssignmentsController: RoleAssignmentsController, private resourcesManager: ResourcesManager,
        private resourceProviderManager: ResourceProviderManager, private usersManager: UsersManager,
        private resourceGroupsController: ResourceGroupsController)
    {
    }
    
    //Public methods
    public async AddResourceLevelRoleAssignment(resourceId: number, roleAssignment: RoleAssignment)
    {
        await this.roleAssignmentsController.AddResourceLevelRoleAssignment(resourceId, roleAssignment);

        const ref = await this.resourcesManager.CreateResourceReference(resourceId);
        await this.resourceProviderManager.ResourcePermissionsChanged(ref!);
    }

    public async DeleteResourceLevelRoleAssignment(resourceId: number, roleAssignment: RoleAssignment)
    {
        await this.roleAssignmentsController.DeleteResourceLevelRoleAssignment(resourceId, roleAssignment);

        //TODO: need a new better concept for this
        /*const hostId = await this.resourcesController.QueryHostIdOfInstance(resourceId);
        const userGroupIds = await this.permissionsController.QueryGroupsAssociatedWithHost(hostId!);

        if(!userGroupIds.has(roleAssignment.objectId))
            await this.hostUsersManager.RemoveGroupFromHost(hostId!, roleAssignment.objectId);*/
    }

    public async HasUserClusterWidePermission(opcUserId: number, permission: string)
    {
        const objectIds = await this.permissionsController.GetObjectsWithClusterWidePermission(permission);
        return this.DoPrincipalObjectsInclude(objectIds, opcUserId);
    }

    public async HasUserPermissionOnResourceGroupScope(resourceGroupId: number, opcUserId: number, permission: string)
    {
        const objectIds = await this.permissionsController.GetObjectsWithResourceGroupLevelPermission(resourceGroupId, permission);
        if(await this.DoPrincipalObjectsInclude(objectIds, opcUserId))
            return true;

        return await this.HasUserClusterWidePermission(opcUserId, permission);
    }

    public async HasUserPermissionOnResourceScope(resourceReference: ResourceReference, opcUserId: number, permission: string)
    {
        const objectIds = await this.permissionsController.GetObjectsWithResourceLevelPermission(resourceReference.id, permission);
        if(await this.DoPrincipalObjectsInclude(objectIds, opcUserId))
            return true;

        const resource = await this.resourcesController.QueryResource(resourceReference.id);
        if(resource === undefined)
            throw new Error("TODO: implement me");

        return await this.HasUserPermissionOnResourceGroupScope(resource.instanceGroupId, opcUserId, permission);
    }

    public async QueryResourceGroupIdsThatUserHasAccessTo(opcUserId: number)
    {
        const permission = permissions.read;
        const cond = await this.HasUserClusterWidePermission(opcUserId, permission);
        if(cond)
        {
            const groups = await this.resourceGroupsController.QueryAllGroups();
            return groups.Values().Map(x => x.id);
        }

        const groups = await this.resourceGroupsController.QueryAllGroups();
        const filtered = [];
        for (const group of groups)
        {
            const cond = await this.HasUserPermissionOnResourceGroupScope(group.id, opcUserId, permission)
            if(cond)
                filtered.push(group.id);
        }
        return filtered.Values();
    }

    public async QueryResourceIdsThatUserHasAccessTo(opcUserId: number)
    {
        const permission = permissions.read;

        const rgIds = await this.QueryResourceGroupIdsThatUserHasAccessTo(opcUserId);
        const resourceIdSets = await this.QueryResourceIdsOfResourceGroups(opcUserId, rgIds);
        const resourceIds = resourceIdSets.Values().Reduce( (x, y) => x.Union(y), new Set<number>());

        const resourceIdsWithDirectAssignments = await this.permissionsController.QueryResourceIdsWithDirectRoleAssignment(permission);
        const directResourceIds = this.FilterResourceIdsThatUserHasPermissionOn(resourceIdsWithDirectAssignments, opcUserId, permission);

        return resourceIds.Union(await directResourceIds.ToSet()).Values();
    }

    public async QueryResourceIdsOfResourcesInResourceGroupThatUserHasAccessTo(opcUserId: number, resourceGroupId: number)
    {
        const permission = permissions.read;
        const cond = await this.HasUserClusterWidePermission(opcUserId, permission) || await this.HasUserPermissionOnResourceGroupScope(resourceGroupId, opcUserId, permission);
        if(cond)
        {
            const resourceIds = await this.resourcesController.QueryAllResourceIdsInResourceGroup(resourceGroupId);
            return resourceIds;
        }

        const resourceIdsWithDirectAssignments = await this.permissionsController.QueryResourceIdsWithDirectRoleAssignmentInResourceGroup(resourceGroupId, permission);
        const directResourceIds = await this.FilterResourceIdsThatUserHasPermissionOn(resourceIdsWithDirectAssignments, opcUserId, permission).ToArray();
        return directResourceIds.Values();
    }

    public async QueryGroupsWithPermission(resourceId: number, permission: string)
    {
        //TODO: cluster level
        //TODO: RG level
        const objectIds = await this.permissionsController.GetObjectsWithResourceLevelPermission(resourceId, permission);
        const groupIds = [];
        for (const objectId of objectIds)
        {
            if(!objectId.startsWith("g"))
                throw new Error("TODO: implement this better!");
            groupIds.push(parseInt(objectId.substring(1)));
        }
        return groupIds.Values();
    }

    //Private methods
    private async DoesGroupInclude(groupId: number, opcUserId: number)
    {
        const members = await this.usersManager.QueryGroupMembers(groupId)
        for (const foundOPCUserId of members)
        {
            if(foundOPCUserId === opcUserId)
                return true;
        }
        return false;
    }

    private async DoesPrincipalObjectInclude(objectId: string, opcUserId: number)
    {
        switch(objectId[0])
        {
            case "g":
                return await this.DoesGroupInclude(parseInt(objectId.substring(1)), opcUserId);
            default:
                throw new Error("Illegal principal object: " + objectId);
        }
    }

    private async DoPrincipalObjectsInclude(objectIds: EnumeratorBuilder<string>, opcUserId: number)
    {
        for (const objectId of objectIds)
        {
            if(await this.DoesPrincipalObjectInclude(objectId, opcUserId))
                return true;
        }
        return false;
    }

    private FilterResourceIdsThatUserHasPermissionOn(resourceIdsWithDirectAssignments: EnumeratorBuilder<number>, opcUserId: number, permission: string)
    {
        const directResourceIds = resourceIdsWithDirectAssignments.Map(async id => (await this.resourcesManager.CreateResourceReference(id))!).Async().Filter(x => this.HasUserPermissionOnResourceScope(x, opcUserId, permission)).Map(x => x.id);
        return directResourceIds;
    }

    private async QueryResourceIdsOfResourceGroups(opcUserId: number, resourceGroupIds: EnumeratorBuilder<number>)
    {
        return await resourceGroupIds.Map(resourceGroupId => this.QueryResourceIdsOfResourcesInResourceGroupThatUserHasAccessTo(opcUserId, resourceGroupId)).Async().Map(x => x.ToSet()).ToArray();
    }
}