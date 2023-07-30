/**
 * OpenPrivateCloud
 * Copyright (C) 2023 Amir Czwink (amir130@hotmail.de)
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
import { APIController, Body, BodyProp, Common, Conflict, Delete, Get, Header, NotFound, Patch, Path, Post } from "acts-util-apilib";
import { ResourceGroup, ResourceGroupsController } from "../data-access/ResourceGroupsController";
import { SessionsManager } from "../services/SessionsManager";
import { PermissionsController } from "../data-access/PermissionsController";
import { permissions } from "openprivatecloud-common";
import { RoleAssignment, RoleAssignmentsController } from "../data-access/RoleAssignmentsController";
import { AnyResourceProperties } from "../resource-providers/ResourceProperties";
import { HostsController } from "../data-access/HostsController";
import { ResourceProviderManager } from "../services/ResourceProviderManager";
import { ResourcesController } from "../data-access/ResourcesController";
import { ResourceReference } from "../common/ResourceReference";
import { ResourcesManager } from "../services/ResourcesManager";
import { ResourceDeploymentService } from "../services/ResourceDeploymentService";
import { ResourceGroupsManager } from "../services/ResourceGroupsManager";
import { HealthStatus } from "../data-access/HealthController";
import { ResourceState } from "../resource-providers/ResourceProvider";

interface ResourceGroupDTO
{
    name: string;
}

interface ResourceGroupWithSession
{
    resourceGroup: ResourceGroup;
    userId: number;
}

interface ResourceOverviewDataDTO
{
    id: string;
    name: string;
    resourceProviderName: string;
    instanceType: string;
    state: ResourceState;
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
        private permissionsController: PermissionsController, private resourcesController: ResourcesController, private resourcesManager: ResourcesManager, private resourceDeploymentService: ResourceDeploymentService)
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

        const instances = await resourceIds.Map(async resourceId => {
            const row = await this.resourcesController.QueryOverviewInstanceData(resourceId);
            const ref = await this.resourcesManager.CreateResourceReference(resourceId);

            const res: ResourceOverviewDataDTO = {
                id: ref!.externalId,
                instanceType: row!.instanceType,
                name: row!.name,
                resourceProviderName: row!.resourceProviderName,
                state: await this.GetResourceState(ref!, row!.status)
            };
            return res;
        }).PromiseAll();
        return instances.Values().ToArray();
    }

    //Private methods
    private async GetResourceState(resourceReference: ResourceReference, healthStatus: HealthStatus): Promise<ResourceState>
    {
        switch(healthStatus)
        {
            case HealthStatus.Corrupt:
                return "corrupt";
            case HealthStatus.Down:
                return "down";
            case HealthStatus.InDeployment:
                return "in deployment";
            case HealthStatus.Up:
            {
                const rp = this.resourceProviderManager.FindResourceProviderByResource(resourceReference);
                const result = await rp.QueryResourceState(resourceReference);
                return (typeof result === "string") ? result : result.state;
            }
        }
    }
}

@APIController("resourceGroups/{resourceGroupName}/roleAssignments")
class _api2_
{
    constructor(private roleAssignmentsController: RoleAssignmentsController, private resourceGroupsController: ResourceGroupsController)
    {
    }

    @Common()
    public async Common(
        @Path resourceGroupName: string
    )
    {
        const group = await this.resourceGroupsController.QueryGroupByName(resourceGroupName);
        if(group === undefined)
            return NotFound("resource group not found");
        return group;
    }

    @Post()
    public async Add(
        @Common resourceGroup: ResourceGroup,
        @Body roleAssignment: RoleAssignment
    )
    {
        await this.roleAssignmentsController.AddInstanceGroupRoleAssignment(resourceGroup.id, roleAssignment);
    }

    @Delete()
    public async Delete(
        @Common resourceGroup: ResourceGroup,
        @Body roleAssignment: RoleAssignment
    )
    {
        await this.roleAssignmentsController.DeleteResourceGroupRoleAssignment(resourceGroup.id, roleAssignment);
    }

    @Get()
    public async RequestInstanceGroupRoleAssignments(
        @Common resourceGroup: ResourceGroup,
    )
    {
        return await this.roleAssignmentsController.QueryResourceGroupRoleAssignments(resourceGroup.id);
    }
}