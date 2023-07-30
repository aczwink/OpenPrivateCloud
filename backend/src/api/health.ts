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

import { APIController, Get, NotFound, Query } from "acts-util-apilib";
import { HealthController, HealthStats, HealthStatus } from "../data-access/HealthController";
import { ResourcesManager } from "../services/ResourcesManager";
import { ResourceProviderManager } from "../services/ResourceProviderManager";
import { TimeSchedule } from "../common/TimeSchedule";
import { ResourceState } from "../resource-providers/ResourceProvider";

interface ClusterHealthStats
{
    hostsHealth: HealthStats[];
    instancesHealth: HealthStats[];
}

interface ResourceCheckDTO
{
    /**
     * @format multi-line
     */
    log: string;

    lastSuccessfulCheck: Date;
    schedule: TimeSchedule;
}

interface ResourceHealthDTO
{
    healthStatus: HealthStatus;
    state: ResourceState;
    hostName: string;
    
    /**
     * @format multi-line
     */
    availabilityLog: string;

    checkData?: ResourceCheckDTO;
}

@APIController("health")
class HealthAPIController
{
    constructor(private healthController: HealthController, private resourcesManager: ResourcesManager, private resourceProviderManager: ResourceProviderManager)
    {
    }

    @Get()
    public async QueueHealthStats()
    {
        const res: ClusterHealthStats = {
            hostsHealth: await this.healthController.QueryHostsHealthStats(),
            instancesHealth: await this.healthController.QueryInstancesHealthStats()
        };
        return res;
    }

    @Get("resource")
    public async QueryResourceHealth(
        @Query id: string
    )
    {
        const ref = await this.resourcesManager.CreateResourceReferenceFromExternalId(id);
        if(ref === undefined)
            return NotFound("resource not found");

        const hd = await this.healthController.QueryResourceHealthData(ref.id);
        const schedule = await this.resourceProviderManager.RetrieveInstanceCheckSchedule(ref.id);
        const resourceProvider = this.resourceProviderManager.FindResourceProviderByResource(ref);
        const stateResult = await resourceProvider.QueryResourceState(ref);

        const res: ResourceHealthDTO = {
            availabilityLog: hd!.availabilityLog,
            healthStatus: hd!.status,
            hostName: ref.hostName,
            state: (typeof stateResult === "string") ? stateResult : stateResult.state
        };
        if(schedule !== null)
        {
            res.checkData = {
                log: hd!.checkLog,
                schedule,
                lastSuccessfulCheck: hd!.lastSuccessfulCheck,
            };
        }

        return res;
    }
}