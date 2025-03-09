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

import { DateTime, Injectable } from "acts-util-node";
import { HealthController, HealthStatus } from "../data-access/HealthController";
import { ResourcesController } from "../data-access/ResourcesController";
import { ResourceProviderManager } from "./ResourceProviderManager";
import { TaskScheduler } from "./TaskScheduler";
import { ResourceGroupsController } from "../data-access/ResourceGroupsController";
import { ErrorService } from "./ErrorService";
import { ResourcesManager } from "./ResourcesManager";
import { ModulesManager } from "./ModulesManager";
import { ResourceCheckType } from "../resource-providers/ResourceProvider";
import { TimeSchedule } from "../common/TimeSchedule";
import { LoggingService } from "./LoggingService";
  
@Injectable
export class ResourceHealthManager
{
    constructor(private resourcesController: ResourcesController, private resourceProviderManager: ResourceProviderManager, private resourceGroupController: ResourceGroupsController,
        private healthController: HealthController, private taskScheduler: TaskScheduler, private modulesManager: ModulesManager,
        private errorService: ErrorService, private resourcesManager: ResourcesManager, private loggingService: LoggingService)
    {
    }
    
    //Public methods
    public async CheckResourceAvailability(resourceId: number)
    {
        const ref = await this.resourcesManager.CreateResourceReference(resourceId);

        let status;        
        try
        {
            status = this.resourceProviderManager.CheckResource(ref!, ResourceCheckType.Availability);
            await this.UpdateResourceAvailability(resourceId, HealthStatus.Up);
        }
        catch(e)
        {
            await this.UpdateResourceAvailability(resourceId, HealthStatus.Down, e);
            status = HealthStatus.Down;
        }

        if(status === HealthStatus.Corrupt)
            this.CheckResourceHealth(resourceId, ResourceCheckType.ServiceHealth);
    }

    public async RequestHealthStatus(resourceId: number)
    {
        const result = await this.healthController.QueryResourceHealthData(resourceId);
        if(result.length === 0)
            return HealthStatus.InDeployment;
        return Math.max(...result.map(x => x.status)) as HealthStatus;
    }

    public async ScheduleResourceChecks(resourceId: number)
    {
        this.ScheduleResourceCheck(resourceId, ResourceCheckType.ServiceHealth);

        const schedule = await this.RequestDataIntegrityCheckSchedule(resourceId);
        if(schedule !== null)
            this.ScheduleResourceCheck(resourceId, ResourceCheckType.DataIntegrity);
    }

    public async ScheduleResourceChecksForAllResources()
    {
        const resourceGroups = await this.resourceGroupController.QueryAllGroups();
        for (const resourceGroup of resourceGroups)
        {
            const resourceIds = await this.resourcesController.QueryAllResourceIdsInResourceGroup(resourceGroup.id);
            for (const resourceId of resourceIds)
            {
                this.ScheduleResourceChecks(resourceId);
            }   
        }
    }

    public async UpdateResourceAvailability(resourceId: number, status: HealthStatus, logData?: unknown)
    {
        const log = this.errorService.ExtractDataAsMultipleLines(logData);
        await this.healthController.UpdateResourceHealth(resourceId, ResourceCheckType.Availability, status, log);
    }

    //Private methods
    private async CheckResourceHealth(resourceId: number, checkType: ResourceCheckType)
    {
        const ref = await this.resourcesManager.CreateResourceReference(resourceId);
        if(ref === undefined)
            return false; //resource was deleted

        const hd = await this.healthController.QueryResourceHealthData(resourceId);
        const availabilityStatus = hd.find(x => x.checkType === ResourceCheckType.Availability)?.status;
        if(availabilityStatus === HealthStatus.Down)
            return false; //resource is not reachable so can't perform health test
        if(availabilityStatus === HealthStatus.InDeployment)
            return true; //resource is still being deployed. Try later

        if(checkType === ResourceCheckType.ServiceHealth)
        {
            const resourceTypeDef = await this.resourceProviderManager.FindResourceTypeDefinition(ref);
            for (const moduleName of resourceTypeDef!.requiredModules)
                await this.modulesManager.EnsureModuleIsInstalled(ref.hostId, moduleName);
        }

        try
        {
            await this.resourceProviderManager.CheckResource(ref, checkType);
        }
        catch(e)
        {
            await this.UpdateResourceHealth(ref.id, checkType, HealthStatus.Corrupt, e);
            this.loggingService.LogError("Resource health check failed", { resourceId, error: e });
            return false;
        }

        await this.UpdateResourceHealth(ref.id, checkType, HealthStatus.Up);
        return true;
    }

    private async RequestDataIntegrityCheckSchedule(resourceId: number)
    {
        const ref = await this.resourcesManager.CreateResourceReference(resourceId);
        const schedule = await this.resourceProviderManager.RetrieveResourceCheckSchedule(ref!);
        return schedule;
    }

    private async ScheduleResourceCheck(resourceId: number, checkType: ResourceCheckType)
    {
        const hd = await this.healthController.QueryResourceHealthData(resourceId);
        const lastSuccessfulCheck = hd.find(x => x.checkType === checkType)?.lastSuccessfulCheck ?? DateTime.ConstructFromUnixTimeStamp(0);

        let schedule: TimeSchedule | null;
        switch(checkType)
        {
            case ResourceCheckType.DataIntegrity:
                schedule = await this.RequestDataIntegrityCheckSchedule(resourceId);
                break;
            case ResourceCheckType.ServiceHealth:
                schedule = { type: "daily", atHour: 3 };
        }

        this.taskScheduler.ScheduleWithOverdueProtection(lastSuccessfulCheck, schedule!, this.OnCheckScheduled.bind(this, resourceId, checkType));
    }

    private async UpdateResourceHealth(resourceId: number, checkType: ResourceCheckType, status: HealthStatus, logData?: unknown)
    {
        const log = this.errorService.ExtractDataAsMultipleLines(logData);
        await this.healthController.UpdateResourceHealth(resourceId, checkType, status, log);
    }

    //Event handlers
    private async OnCheckScheduled(resourceId: number, checkType: ResourceCheckType)
    {        
        const checkResult = await this.CheckResourceHealth(resourceId, checkType);
        if(checkResult)
            this.ScheduleResourceCheck(resourceId, checkType);
    }
}