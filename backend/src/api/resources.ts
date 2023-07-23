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
import { ResourceLogsController } from "../data-access/ResourceLogsController";
import { ResourcesController } from "../data-access/ResourcesController";
import { ResourcesManager } from "../services/ResourcesManager";

@APIController("resources")
class _api_
{
    constructor(private resourceLogsController: ResourceLogsController, private resourcesController: ResourcesController, private resourcesManager: ResourcesManager)
    {
    }

    @Get("logs/{logId}")
    public async QueryInstanceLog(
        @Path logId: number
    )
    {
        const log = await this.resourceLogsController.QueryInstanceLog(logId);
        if(log === undefined)
            return NotFound("instance or log not found");

        return log;
    }

    @Get("logs")
    public async QueryResourceLogs(
        @Query resourceId: string
    )
    {
        const ref = await this.resourcesManager.CreateResourceReferenceFromExternalId(resourceId);
        if(ref === undefined)
            return NotFound("resource not found");

        const logs = await this.resourceLogsController.QueryResourceLogs(ref.id);
        return logs;
    }

    @Get("search")
    public async SearchForResource(
        @Query hostName: string,
        @Query resourceProviderName: string,
        @Query resourceTypeName: string,
        @Query resourceNameFilter: string
    )
    {
        const ids = await this.resourcesController.Search(hostName, resourceProviderName, resourceTypeName, resourceNameFilter);
        const all = await ids.Values().Map(x => this.resourcesManager.CreateResourceReference(x)).PromiseAll();
        return all.Values().NotUndefined().Map(x => x.externalId).ToArray();
    }
}