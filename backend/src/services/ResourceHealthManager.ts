/**
 * OpenPrivateCloud
 * Copyright (C) 2019-2024 Amir Czwink (amir130@hotmail.de)
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
import { ResourcesController } from "../data-access/ResourcesController";
import { UserGroupsController } from "../data-access/UserGroupsController";
import { NotificationsManager } from "./NotificationsManager";
import { ResourceProviderManager } from "./ResourceProviderManager";
import { TaskScheduler } from "./TaskScheduler";
import { ResourceGroupsController } from "../data-access/ResourceGroupsController";
import { ErrorService } from "./ErrorService";
import { ResourcesManager } from "./ResourcesManager";
import { ResourceReference } from "../common/ResourceReference";
import { ResourceState, ResourceStateResult } from "../resource-providers/ResourceProvider";
  
@Injectable
export class ResourceHealthManager
{
    constructor(private resourcesController: ResourcesController, private resourceProviderManager: ResourceProviderManager, private resourceGroupController: ResourceGroupsController,
        private healthController: HealthController, private taskScheduler: TaskScheduler, private notificationsManager: NotificationsManager,
        private userGroupsController: UserGroupsController, private errorService: ErrorService, private resourcesManager: ResourcesManager)
    {
    }
    
    //Public methods
    public async CheckResourceAvailability(resourceId: number)
    {
        const ref = await this.resourcesManager.CreateResourceReference(resourceId);
        const resourceProvider = this.resourceProviderManager.FindResourceProviderByResource(ref!);

        let status;        
        try
        {
            const result = await resourceProvider.QueryResourceState(ref!);
            const extracted = this.ExtractResourceStateResult(result);
            await this.UpdateResourceAvailability(resourceId, extracted.status, extracted.msg);
            status = extracted.status;
        }
        catch(e)
        {
            await this.UpdateResourceAvailability(resourceId, HealthStatus.Down, e);
            status = HealthStatus.Down;
        }

        if(status === HealthStatus.Corrupt)
            this.CheckResource(resourceId);
    }

    public async ScheduleResourceCheck(resourceId: number)
    {
        const schedule = await this.resourceProviderManager.RetrieveInstanceCheckSchedule(resourceId);
        if(schedule === null)
            return;

        const hd = await this.healthController.QueryResourceHealthData(resourceId);
        const lastSuccessfulCheck = hd?.lastSuccessfulCheck ?? new Date(0);

        this.taskScheduler.ScheduleWithOverdueProtection(lastSuccessfulCheck, schedule, this.OnInstanceCheckScheduled.bind(this, resourceId));
    }

    public async ScheduleResourceChecks()
    {
        const resourceGroups = await this.resourceGroupController.QueryAllGroups();
        for (const resourceGroup of resourceGroups)
        {
            const resourceIds = await this.resourcesController.QueryAllResourceIdsInResourceGroup(resourceGroup.id);
            for (const resourceId of resourceIds)
            {
                this.ScheduleResourceCheck(resourceId);
            }   
        }
    }

    public async UpdateResourceAvailability(resourceId: number, status: HealthStatus, logData?: unknown)
    {
        const log = this.errorService.ExtractDataAsMultipleLines(logData);
        await this.healthController.UpdateResourceAvailability(resourceId, status, log);
    }

    //Private methods
    private async CheckResource(resourceId: number)
    {
        const ref = await this.resourcesManager.CreateResourceReference(resourceId);
        if(ref === undefined)
            return false; //resource was deleted

        const hd = await this.healthController.QueryResourceHealthData(resourceId);
        if(hd?.status === HealthStatus.Down)
            return false; //resource is not reachable so can't perform health test
        if(hd?.status === HealthStatus.InDeployment)
            return true; //resource is still being deployed. Try later

        const resourceProvider = this.resourceProviderManager.FindResourceProviderByResource(ref);

        try
        {
            await resourceProvider.CheckResourceHealth(ref);
        }
        catch(e)
        {
            await this.UpdateResourceHealth(ref.id, HealthStatus.Corrupt, e);
            const userGroupId = await this.FindGroupAssociatedWithInstance(ref);
            await this.notificationsManager.SendErrorNotification(userGroupId, "Instance health check failed", e);
            return false;
        }

        await this.UpdateResourceHealth(ref.id, HealthStatus.Up);
        return true;
    }

    private ExtractResourceStateResult(result: ResourceStateResult)
    {
        function GetHealthStatus(state: ResourceState)
        {
            switch(state)
            {
                case "corrupt":
                    return HealthStatus.Corrupt;
                case "down":
                    return HealthStatus.Down;
                case "in deployment":
                    return HealthStatus.InDeployment;
            }
            return HealthStatus.Up;
        }

        if(typeof result === "string")
            return { status: GetHealthStatus(result), msg: "" };
        else
            return { status: GetHealthStatus(result.state), msg: result.context };
    }

    private async FindGroupAssociatedWithInstance(resourceReference: ResourceReference)
    {
        //TODO: instances would need an owner or creator
        const groups = await this.userGroupsController.QueryUserGroups();
        return groups[0].id;
    }

    private async UpdateResourceHealth(resourceId: number, status: HealthStatus, logData?: unknown)
    {
        const log = this.errorService.ExtractDataAsMultipleLines(logData);
        await this.healthController.UpdateResourceHealth(resourceId, status, log);
    }

    //Event handlers
    private async OnInstanceCheckScheduled(instanceId: number)
    {
        const checkResult = await this.CheckResource(instanceId);
        if(checkResult)
            this.ScheduleResourceCheck(instanceId);
    }
}