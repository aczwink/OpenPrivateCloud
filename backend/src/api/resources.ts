/**
 * OpenPrivateCloud
 * Copyright (C) 2019-2023 Amir Czwink (amir130@hotmail.de)
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
import { APIController, Get, NotFound, Path, Query } from "acts-util-apilib";
import { InstanceLogsController } from "../data-access/InstanceLogsController";
import { ResourcesController } from "../data-access/ResourcesController";

@APIController("resources")
class _api_
{
    constructor(private instanceLogsController: InstanceLogsController, private instancesController: ResourcesController)
    {
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