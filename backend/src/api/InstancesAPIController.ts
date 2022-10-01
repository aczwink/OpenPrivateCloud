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
import { APIController, Body, Delete, Get, Header, NotFound, Path, Post } from "acts-util-apilib";
import { BaseResourceProperties } from "../resource-providers/ResourceProvider";
import { ResourceProviderManager } from "../services/ResourceProviderManager";
import { HostsController } from "../data-access/HostsController";
import { SessionsManager } from "../services/SessionsManager";
import { Instance, InstancesController } from "../data-access/InstancesController";

//TODO
import { FileStorageProperties } from "../resource-providers/file-services/FileStorageProperties";
//TODO

@APIController("instances")
class InstancesAPIController
{
    constructor(private resourceProviderManager: ResourceProviderManager, private hostsController: HostsController, private sessionsManager: SessionsManager,
        private instancesController: InstancesController)
    {
    }

    @Delete("{fullInstanceName}")
    public async DeleteInstance(
        @Path fullInstanceName: string
    )
    {
        await this.resourceProviderManager.DeleteInstance(fullInstanceName);
    }

    @Post()
    public async DeployInstance(
        //@Body @DerivativeOf instanceProperties: BaseResourceProperties
        @Body instanceProperties: FileStorageProperties,
        @Header Authorization: string
    )
    {
        const hostId = await this.hostsController.RequestHostId(instanceProperties.hostName);
        if(hostId === undefined)
            return NotFound("host not found");

        await this.resourceProviderManager.DeployInstance(instanceProperties, hostId, this.sessionsManager.GetUserIdFromAuthHeader(Authorization));
    }

    @Get()
    public async QueryInstances(): Promise<Instance[]>
    {
        return await this.instancesController.QueryInstances();
    }
}