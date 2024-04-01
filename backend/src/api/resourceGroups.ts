/**
 * OpenPrivateCloud
 * Copyright (C) 2023-2024 Amir Czwink (amir130@hotmail.de)
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
import { APIController, Body, BodyProp, Common, Conflict, Delete, Forbidden, Get, Header, NotFound, Patch, Path, Post } from "acts-util-apilib";
import { ResourceGroup, ResourceGroupsController } from "../data-access/ResourceGroupsController";
import { SessionsManager } from "../services/SessionsManager";
import { PermissionsController } from "../data-access/PermissionsController";
import { permissions } from "openprivatecloud-common";
import { RoleAssignment, RoleAssignmentsController } from "../data-access/RoleAssignmentsController";
import { AnyResourceProperties } from "../resource-providers/ResourceProperties";
import { HostsController } from "../data-access/HostsController";
import { ResourceProviderManager } from "../services/ResourceProviderManager";
import { ResourcesManager } from "../services/ResourcesManager";
import { ResourceDeploymentService } from "../services/ResourceDeploymentService";
import { ResourceGroupsManager } from "../services/ResourceGroupsManager";
import { ResourceQueryService } from "../services/ResourceQueryService";
import { PermissionsManager } from "../services/PermissionsManager";

interface ResourceGroupDTO
{
    name: string;
}

interface ResourceGroupWithSession
{
    resourceGroup: ResourceGroup;
    userId: number;
}

function ToDTO(input: ResourceGroup | undefined): ResourceGroupDTO | undefined
{
    if(input === undefined)
        return undefined;

    return {
        name: input.name
    };
}

@APIController("resourceGroups")
class _api_
{
    constructor(private resourceGroupsController: ResourceGroupsController, private sessionsManager: SessionsManager, private permissionsController: PermissionsController)
    {
    }

    @Post()
    public async CreateGroup(
        @Body data: ResourceGroupDTO,
    )
    {
        return await this.resourceGroupsController.CreateGroup(data);
    }

    @Get()
    public async QueryInstanceGroups(
        @Header Authorization: string
    )
    {
        const userId = this.sessionsManager.GetUserIdFromAuthHeader(Authorization);

        let groups;
        if(await this.permissionsController.HasUserClusterWidePermission(userId, permissions.read))
            groups = await this.resourceGroupsController.QueryAllGroups();
        else
        {
            const groupIds = await this.permissionsController.QueryResourceGroupIdsThatUserHasAccessTo(userId);
            const result = await groupIds.Map(id => this.resourceGroupsController.QueryGroup(id)).PromiseAll();
            groups = result;
        }

        return groups.Values().Map(ToDTO).NotUndefined().ToArray();
    }
}

@APIController("resourceGroups/{resourceGroupName}")
class _api4_
{
    constructor(private resourceGroupsController: ResourceGroupsController, private roleAssignmentsController: RoleAssignmentsController, private resourceGroupsManager: ResourceGroupsManager)
    {
    }

    @Delete()
    public async DeleteGroup(
        @Path resourceGroupName: string
    )
    {
        const group = await this.resourceGroupsController.QueryGroupByName(resourceGroupName);
        if(group === undefined)
            return NotFound("resource group not found");

        const roleAssignments = await this.roleAssignmentsController.QueryResourceGroupRoleAssignments(group.id);
        for (const roleAssignment of roleAssignments)
            await this.roleAssignmentsController.DeleteResourceGroupRoleAssignment(group.id, roleAssignment);
        await this.resourceGroupsController.DeleteGroup(group.id);
    }

    @Patch()
    public async ChangeGroupName(
        @Path resourceGroupName: string,
        @BodyProp newResourceGroupName: string
    )
    {
        const group = await this.resourceGroupsController.QueryGroupByName(resourceGroupName);
        if(group === undefined)
            return NotFound("resource group not found");

        await this.resourceGroupsManager.ChangeGroupName(group.id, newResourceGroupName);
    }

    @Get()
    public async QueryGroup(
        @Path resourceGroupName: string
    )
    {
        return ToDTO(await this.resourceGroupsController.QueryGroupByName(resourceGroupName));
    }
}

@APIController("resourceGroups/{resourceGroupName}/resources")
class _api3_
{
    constructor(private resourceGroupsController: ResourceGroupsController, private hostsController: HostsController, private resourceProviderManager: ResourceProviderManager, private sessionsManager: SessionsManager,
        private permissionsController: PermissionsController, private resourcesManager: ResourcesManager, private resourceDeploymentService: ResourceDeploymentService,
        private resourceQueryService: ResourceQueryService)
    {
    }

    @Common()
    public async Common(
        @Path resourceGroupName: string,
        @Header Authorization: string
    )
    {
        const group = await this.resourceGroupsController.QueryGroupByName(resourceGroupName);
        if(group === undefined)
            return NotFound("resource group not found");

        const res: ResourceGroupWithSession = {
            resourceGroup: group,
            userId: this.sessionsManager.GetUserIdFromAuthHeader(Authorization)
        }
        return res;
    }

    @Patch("group")
    public async ChangeResourceGroup(
        @Common common: ResourceGroupWithSession,
        @BodyProp resourceId: string,
        @BodyProp newResourceGroupName: string
    )
    {
        const ref = await this.resourcesManager.CreateResourceReferenceFromExternalId(resourceId);
        if(ref === undefined)
            return NotFound("resource not found");

        const newGroup = await this.resourceGroupsController.QueryGroupByName(newResourceGroupName);
        if(newGroup === undefined)
            return NotFound("new resource group not found");

        await this.resourcesManager.ChangeResourceGroup(ref, newGroup.id);
    }

    @Patch("name")
    public async ChangeResourceName(
        @Common common: ResourceGroupWithSession,
        @BodyProp resourceId: string,
        @BodyProp newResourceName: string
    )
    {
        const ref = await this.resourcesManager.CreateResourceReferenceFromExternalId(resourceId);
        if(ref === undefined)
            return NotFound("resource not found");

        await this.resourcesManager.ChangeResourceName(ref, newResourceName);
    }

    @Delete()
    public async DeleteResource(
        @Common common: ResourceGroupWithSession,
        @BodyProp resourceId: string
    )
    {
        const ref = await this.resourcesManager.CreateResourceReferenceFromExternalId(resourceId);
        if(ref === undefined)
            return NotFound("resource not found");

        const result = await this.resourceProviderManager.DeleteResource(ref);
        if(result !== null)
        {
            switch(result.type)
            {
                case "ConflictingState":
                    return Conflict(result.message);
            }
        }
    }

    @Post()
    public async DeployResource(
        @Common common: ResourceGroupWithSession,
        @Body properties: AnyResourceProperties,
    )
    {
        const hostId = await this.hostsController.RequestHostId(properties.hostName);
        if(hostId === undefined)
            return NotFound("host not found");

        await this.resourceDeploymentService.StartInstanceDeployment(properties, common.resourceGroup, hostId, common.userId);
    }

    @Get()
    public async QueryResources(
        @Common common: ResourceGroupWithSession
    )
    {
        const resourceIds = await this.permissionsController.QueryResourceIdsOfResourcesInResourceGroupThatUserHasAccessTo(common.userId, common.resourceGroup.id);
        return this.resourceQueryService.QueryOverviewData(resourceIds);
    }
}

interface ResourceGroupAndUserId
{
    resourceGroupId: number;
    userId: number;
}

@APIController("resourceGroups/{resourceGroupName}/roleAssignments")
class _api2_
{
    constructor(private roleAssignmentsController: RoleAssignmentsController, private resourceGroupsController: ResourceGroupsController, private sessionsManager: SessionsManager, private permissionsManager: PermissionsManager)
    {
    }

    @Common()
    public async Common(
        @Path resourceGroupName: string,
        @Header Authorization: string
    )
    {
        const group = await this.resourceGroupsController.QueryGroupByName(resourceGroupName);
        if(group === undefined)
            return NotFound("resource group not found");

        const res: ResourceGroupAndUserId = {
            resourceGroupId: group.id,
            userId: this.sessionsManager.GetUserIdFromAuthHeader(Authorization)
        }
        return res;
    }

    @Post()
    public async Add(
        @Common context: ResourceGroupAndUserId,
        @Body roleAssignment: RoleAssignment
    )
    {
        const canWriteData = await this.permissionsManager.HasUserPermissionOnResourceGroupScope(context.resourceGroupId, context.userId, permissions.roleAssignments.write);
        if(!canWriteData)
            return Forbidden("write access to role assignments denied");

        await this.roleAssignmentsController.AddInstanceGroupRoleAssignment(context.resourceGroupId, roleAssignment);
    }

    @Delete()
    public async Delete(
        @Common context: ResourceGroupAndUserId,
        @Body roleAssignment: RoleAssignment
    )
    {
        const canWriteData = await this.permissionsManager.HasUserPermissionOnResourceGroupScope(context.resourceGroupId, context.userId, permissions.roleAssignments.write);
        if(!canWriteData)
            return Forbidden("delete access to role assignments denied");

        await this.roleAssignmentsController.DeleteResourceGroupRoleAssignment(context.resourceGroupId, roleAssignment);
    }

    @Get()
    public async RequestInstanceGroupRoleAssignments(
        @Common context: ResourceGroupAndUserId,
    )
    {
        return await this.roleAssignmentsController.QueryResourceGroupRoleAssignments(context.resourceGroupId);
    }
}