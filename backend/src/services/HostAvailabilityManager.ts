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

import { Injectable } from "acts-util-node";
import { HealthController, HealthStatus } from "../data-access/HealthController";
import { HostsController } from "../data-access/HostsController";
import { ResourcesController } from "../data-access/ResourcesController";
import { ModulesManager } from "./ModulesManager";
import { RemoteConnectionsManager } from "./RemoteConnectionsManager";
import { ResourceProviderManager } from "./ResourceProviderManager";

 
@Injectable
export class HostAvailabilityManager
{
    constructor(private modulesManager: ModulesManager, private hostsController: HostsController, private instancesController: ResourcesController,
        private resourceProviderManager: ResourceProviderManager, private remoteConnectionsManager: RemoteConnectionsManager,
        private healthController: HealthController)
    {
    }

    //Public methods
    public async CheckAvailabilityOfHostsAndItsInstances()
    {
        const hostIds = await this.hostsController.RequestHostIds();
        for (const hostId of hostIds)
        {
            await this.CheckAvailabilityOfHostAndItsInstances(hostId);
        }
    }

    public async EnsureHostIsConfiguredAppropriatly(hostId: number)
    {
        await this.modulesManager.EnsureModuleIsInstalled(hostId, "core");
    }

    //Private methods
    private async CheckAvailabilityOfHostAndItsInstances(hostId: number)
    {
        const instanceIds = await this.instancesController.QueryInstanceIdsAssociatedWithHost(hostId);

        const available = await this.CheckHostAvailability(hostId);
        if(!available)
        {
            for (const instanceId of instanceIds)
                await this.healthController.UpdateInstanceAvailability(instanceId, HealthStatus.Down, "host is not available");
            return;
        }

        for (const instanceId of instanceIds)
        {
            await this.CheckInstanceAvailability(instanceId);
        }
    }

    private async CheckHostAvailability(hostId: number)
    {
        try
        {
            const conn = await this.remoteConnectionsManager.AcquireConnection(hostId);
            conn.Release();
        }
        catch(e)
        {
            await this.healthController.UpdateHostHealth(hostId, HealthStatus.Down, e);
            return false;
        }
        await this.healthController.UpdateHostHealth(hostId, HealthStatus.Up);
        return true;
    }

    private async CheckInstanceAvailability(instanceId: number)
    {
        const instance = await this.instancesController.QueryResource(instanceId);
        try
        {
            await this.resourceProviderManager.CheckInstanceAvailability(instance!.name);
        }
        catch(e)
        {
            await this.healthController.UpdateInstanceAvailability(instanceId, HealthStatus.Down, e);
            return;
        }
        await this.healthController.UpdateInstanceAvailability(instanceId, HealthStatus.Up);
    }
}