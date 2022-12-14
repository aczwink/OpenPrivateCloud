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
import { InstancesController } from "../data-access/InstancesController";
import { InstanceLogsController } from "../data-access/InstanceLogsController";
import { permissions } from "openprivatecloud-common";
import { PermissionsController } from "../data-access/PermissionsController";
import { PermissionsManager } from "../services/PermissionsManager";

interface InstanceDto
{
    fullName: string;
}

@APIController("instances")
class InstancesAPIController
{
    constructor(private resourceProviderManager: ResourceProviderManager, private hostsController: HostsController, private sessionsManager: SessionsManager,
        private instancesController: InstancesController, private instanceLogsController: InstanceLogsController, private permissionsController: PermissionsController)
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

        await this.resourceProviderManager.StartInstanceDeployment(instanceProperties, hostId, this.sessionsManager.GetUserIdFromAuthHeader(Authorization));
    }

    @Get()
    public async QueryInstances(
        @Header Authorization: string
    ): Promise<InstanceDto[]>
    {
        const userId = this.sessionsManager.GetUserIdFromAuthHeader(Authorization);

        let instanceIds;
        if(await this.permissionsController.HasUserClusterWidePermission(userId, permissions.read))
            instanceIds = await this.instancesController.QueryAllInstanceIds();
        else
            instanceIds = await this.permissionsController.QueryInstanceIdsThatUserHasAccessTo(userId);

        const instances = await instanceIds.Map(x => this.instancesController.QueryInstanceById(x)).PromiseAll();
        return instances.Values().NotUndefined().Map(x => ({
            fullName: x.fullName
        })).ToArray();
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