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
import { APIController, BodyProp, Delete, Get, NotFound, Path, Post, Query } from "acts-util-apilib";
import { HostsController, HostStorageCreationProperties } from "../dataaccess/HostsController";
import { HostsManager } from "../services/HostsManager";

@APIController("hosts")
class HostsAPIController
{
    constructor(private hostsManager: HostsManager, private hostsController: HostsController)
    {
    }

    @Post()
    public async AddHost(
        @BodyProp hostName: string
    )
    {
        await this.hostsManager.TakeOverHost(hostName);
    }

    @Get()
    public QueueHosts()
    {
        return this.hostsController.RequestHosts();
    }
}

@APIController("hosts/{hostName}")
class HostAPIController
{
    constructor(private hostsController: HostsController)
    {
    }

    @Delete()
    public async DeleteHost(
        @Path hostName: string
    )
    {
        await this.hostsController.DeleteHost(hostName);
    }

    @Get()
    public async QueryHost(
        @Path hostName: string
    )
    {
        const host = await this.hostsController.RequestHost(hostName);
        if(host === undefined)
            return NotFound("host does not exist");
            
        return host;
    }
}

@APIController("hosts/{hostName}/storages")
class HostStoragesAPIController
{
    constructor(private hostsController: HostsController, private hostsManager: HostsManager)
    {
    }

    @Post()
    public async AddStorage(
        @Path hostName: string,
        @BodyProp props: HostStorageCreationProperties
    )
    {
        const hostId = await this.hostsController.RequestHostId(hostName);
        if(hostId === undefined)
            return NotFound("host does not exist");

        await this.hostsManager.AddHostStorage(hostId, props);
    }

    @Get()
    public async QueryStorages(
        @Path hostName: string
    )
    {
        const hostId = await this.hostsController.RequestHostId(hostName);
        if(hostId === undefined)
            return NotFound("host does not exist");
            
        return this.hostsController.RequestHostStorages(hostId);
    }
}

@APIController("hosts/{hostName}/storage")
class HostStorageAPIController
{
    constructor(private hostsController: HostsController)
    {
    }

    @Delete()
    public async DeleteStorage(
        @Path hostName: string,
        @BodyProp storagePath: string
    )
    {
        const hostId = await this.hostsController.RequestHostId(hostName);
        if(hostId === undefined)
            return NotFound("host does not exist");

        await this.hostsController.DeleteHostStorage(hostId, storagePath);
    }

    @Get()
    public async QueryStorage(
        @Path hostName: string,
        @Query storagePath: string
    )
    {
        const hostId = await this.hostsController.RequestHostId(hostName);
        if(hostId === undefined)
            return NotFound("host does not exist");

        const hostStorage = await this.hostsController.RequestHostStorage(hostId, storagePath);
        if(hostStorage === undefined)
            return NotFound("host storage does not exist");

        return hostStorage;
    }
}