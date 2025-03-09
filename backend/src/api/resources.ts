/**
 * OpenPrivateCloud
 * Copyright (C) 2019-2025 Amir Czwink (amir130@hotmail.de)
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
import { APIController, Auth, Get, NotFound, Path, Query } from "acts-util-apilib";
import { ResourceLogsController } from "../data-access/ResourceLogsController";
import { ResourcesController } from "../data-access/ResourcesController";
import { ResourcesManager } from "../services/ResourcesManager";
import { ResourceQueryService } from "../services/ResourceQueryService";
import { AccessToken } from "../api_security";
import { UsersManager } from "../services/UsersManager";

@APIController("resources")
class _api_
{
    constructor(private resourceLogsController: ResourceLogsController, private resourcesController: ResourcesController, private resourcesManager: ResourcesManager,
        private resourceQueryService: ResourceQueryService, private usersManager: UsersManager)
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

    @Get()
    public async QueryResources(
        @Auth("jwt") accessToken: AccessToken
    )
    {
        const opcUserId = await this.usersManager.MapOAuth2SubjectToOPCUserId(accessToken.sub);
        const resourceIds = await this.resourceQueryService.QueryResourceIds(opcUserId);
        return this.resourceQueryService.QueryOverviewData(resourceIds);
    }

    @Get("host")
    public async QueryHostResources(
        @Query hostName: string
    )
    {
        const resourceIds = await this.resourceQueryService.QueryHostResourceIds(hostName);
        if(resourceIds === undefined)
            return NotFound("host does not exist");
        return this.resourceQueryService.QueryOverviewData(resourceIds.Values());
    }

    @Get("search")
    public async SearchForResource(
        @Query resourceProviderName: string,
        @Query resourceTypeName: string,
        @Query resourceNameFilter: string,
        @Query hostName?: string,
    )
    {
        const idsPromise = (hostName === undefined) ? this.resourcesController.Search(resourceProviderName, resourceTypeName, resourceNameFilter) : this.resourcesController.SearchOnHost(hostName, resourceProviderName, resourceTypeName, resourceNameFilter);
        const ids = await idsPromise;
        const all = await ids.Values().Map(x => this.resourcesManager.CreateResourceReference(x)).PromiseAll();
        return all.Values().NotUndefined().Map(x => x.externalId).ToArray();
    }
}