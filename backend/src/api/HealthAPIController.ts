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
import { HealthController, HealthStats } from "../data-access/HealthController";
import { InstancesController } from "../data-access/InstancesController";

interface ClusterHealthStats
{
    hostsHealth: HealthStats[];
    instancesHealth: HealthStats[];
}

@APIController("health")
class HealthAPIController
{
    constructor(private healthController: HealthController, private instancesController: InstancesController)
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

    @Get("instance")
    public async QueueInstanceHealth(
        @Query fullInstanceName: string
    )
    {
        const instance = await this.instancesController.QueryInstance(fullInstanceName);
        if(instance === undefined)
            return NotFound("instance not found");

        return this.healthController.QueryInstanceHealthData(instance.id);
    }
}