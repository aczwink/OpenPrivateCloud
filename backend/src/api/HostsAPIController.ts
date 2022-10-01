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