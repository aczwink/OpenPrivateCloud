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
import { APIController, BodyProp, Delete, Get, NotFound, Path, Post } from "acts-util-apilib";
import { HostsController } from "../data-access/HostsController";
import { HostStorageCreationProperties, HostStoragesController } from "../data-access/HostStoragesController";
import { HostStoragesManager } from "../services/HostStoragesManager";

@APIController("hosts/{hostName}/storages")
class HostStoragesAPIController
{
    constructor(private hostsController: HostsController, private hostStoragesManager: HostStoragesManager)
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

        await this.hostStoragesManager.AddHostStorage(hostId, props);
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

@APIController("hostStorages/{storageId}")
class HostStorageAPIController
{
    constructor(private hostStoragesController: HostStoragesController)
    {
    }

    @Delete()
    public async DeleteStorage(
        @Path storageId: number
    )
    {
        await this.hostStoragesController.DeleteHostStorage(storageId);
    }

    @Get()
    public async QueryStorage(
        @Path storageId: number
    )
    {
        const hostStorage = await this.hostStoragesController.RequestHostStorage(storageId);
        if(hostStorage === undefined)
            return NotFound("host storage does not exist");

        return hostStorage;
    }
}