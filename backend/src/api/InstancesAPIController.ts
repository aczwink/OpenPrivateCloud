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
import { APIController, Body, BodyProp, Conflict, Delete, Get, Header, NotFound, Path, Post, Query } from "acts-util-apilib";
import { AnyResourceProperties } from "../resource-providers/ResourceProperties";
import { ResourceProviderManager } from "../services/ResourceProviderManager";
import { HostsController } from "../data-access/HostsController";
import { SessionsManager } from "../services/SessionsManager";
import { InstancePermission, InstancesController } from "../data-access/InstancesController";
import { PermissionsManager } from "../services/PermissionsManager";
import { InstanceLogsController } from "../data-access/InstanceLogsController";

interface InstanceDto
{
    fullName: string;
}

@APIController("instances")
class InstancesAPIController
{
    constructor(private resourceProviderManager: ResourceProviderManager, private hostsController: HostsController, private sessionsManager: SessionsManager,
        private instancesController: InstancesController, private instanceLogsController: InstanceLogsController)
    {
    }

    @Delete()
    public async DeleteInstance(
        @BodyProp fullInstanceName: string
    )
    {
        const result = await this.resourceProviderManager.DeleteInstance(fullInstanceName);
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
    public async DeployInstance(
        @Body instanceProperties: AnyResourceProperties,
        @Header Authorization: string
    )
    {
        const hostId = await this.hostsController.RequestHostId(instanceProperties.hostName);
        if(hostId === undefined)
            return NotFound("host not found");

        await this.resourceProviderManager.DeployInstance(instanceProperties, hostId, this.sessionsManager.GetUserIdFromAuthHeader(Authorization));
    }

    @Get()
    public async QueryInstances(): Promise<InstanceDto[]>
    {
        const instances = await this.instancesController.QueryInstances();
        return instances.map(x => ({
            fullName: x.fullName
        }));
    }

    @Get("logs/{logId}")
    public async QueryInstanceLog(
        @Path logId: number
    )
    {
        const log = await this.instanceLogsController.QueryInstanceLog(logId);
        if(log === undefined)
            return NotFound("instance or log not found");

        return log;
    }

    @Get("logs")
    public async QueryInstanceLogs(
        @Query fullInstanceName: string
    )
    {
        const logs = await this.instanceLogsController.QueryInstanceLogs(fullInstanceName);
        return logs;
    }

    @Get("search")
    public async SearchForInstance(
        @Query hostName: string,
        @Query type: string,
        @Query instanceNameFilter: string
    )
    {
        return await this.instancesController.Search(hostName, "/" + type + "%" + instanceNameFilter + "%");
    }
}

@APIController("instances/permissions")
class InstancePermissionsAPIController
{
    constructor(private instancesController: InstancesController, private permissionsManager: PermissionsManager, private resourceProviderManager: ResourceProviderManager)
    {
    }

    @Post()
    public async Add(
        @Query fullInstanceName: string,
        @Body instancePermission: InstancePermission
    )
    {
        await this.permissionsManager.AddInstancePermission(fullInstanceName, instancePermission);
        await this.resourceProviderManager.InstancePermissionsChanged(fullInstanceName);
    }

    @Delete()
    public async Delete(
        @Query fullInstanceName: string,
        @Body instancePermission: InstancePermission
    )
    {
        await this.permissionsManager.DeleteInstancePermission(fullInstanceName, instancePermission);
        await this.resourceProviderManager.InstancePermissionsChanged(fullInstanceName);
    }

    @Get()
    public async QueryInstancePermissions(
        @Query fullInstanceName: string
    )
    {
        return await this.instancesController.QueryInstancePermissions(fullInstanceName);
    }
}