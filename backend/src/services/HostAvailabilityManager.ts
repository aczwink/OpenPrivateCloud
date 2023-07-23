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

import { Injectable } from "acts-util-node";
import { HealthController, HealthStatus } from "../data-access/HealthController";
import { HostsController } from "../data-access/HostsController";
import { ResourcesController } from "../data-access/ResourcesController";
import { ModulesManager } from "./ModulesManager";
import { RemoteConnectionsManager } from "./RemoteConnectionsManager";
import { ResourceHealthManager } from "./ResourceHealthManager";
import { ErrorService } from "./ErrorService";

 
@Injectable
export class HostAvailabilityManager
{
    constructor(private modulesManager: ModulesManager, private hostsController: HostsController, private instancesController: ResourcesController, private healthController: HealthController,
        private remoteConnectionsManager: RemoteConnectionsManager, private errorService: ErrorService,
        private resourceHealthManager: ResourceHealthManager)
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
        const resourceIds = await this.instancesController.QueryInstanceIdsAssociatedWithHost(hostId);

        const available = await this.CheckHostAvailability(hostId);
        if(!available)
        {
            for (const resourceId of resourceIds)
                await this.resourceHealthManager.UpdateResourceAvailability(resourceId, HealthStatus.Down, "host is not available");
            return;
        }

        for (const resourceId of resourceIds)
        {
            await this.resourceHealthManager.CheckResourceAvailability(resourceId);
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
            await this.UpdateHostHealth(hostId, HealthStatus.Down, e);
            return false;
        }
        await this.UpdateHostHealth(hostId, HealthStatus.Up);
        return true;
    }

    private async UpdateHostHealth(hostId: number, status: HealthStatus, logData?: unknown)
    {
        const log = this.errorService.ExtractDataAsMultipleLines(logData);
        await this.healthController.UpdateHostHealth(hostId, status, log);
    }
}