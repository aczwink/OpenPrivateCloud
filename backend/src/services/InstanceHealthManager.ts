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
import { Resource, ResourcesController } from "../data-access/ResourcesController";
import { UserGroupsController } from "../data-access/UserGroupsController";
import { NotificationsManager } from "./NotificationsManager";
import { ResourceProviderManager } from "./ResourceProviderManager";
import { TaskScheduler } from "./TaskScheduler";
import { ResourceGroupsController } from "../data-access/ResourceGroupsController";
  
@Injectable
export class InstanceHealthManager
{
    constructor(private resourcesController: ResourcesController, private resourceProviderManager: ResourceProviderManager, private resourceGroupController: ResourceGroupsController,
        private healthController: HealthController, private taskScheduler: TaskScheduler, private notificationsManager: NotificationsManager,
        private userGroupsController: UserGroupsController)
    {
    }
    
    //Public methods
    public async ScheduleInstanceChecks()
    {
        const resourceGroups = await this.resourceGroupController.QueryAllGroups();
        for (const resourceGroup of resourceGroups)
        {
            const resourceIds = await this.resourcesController.QueryAllResourceIdsInResourceGroup(resourceGroup.id);
            for (const resourceId of resourceIds)
            {
                this.ScheduleInstanceCheck(resourceId);
            }   
        }
    }

    //Private methods
    private async CheckInstance(instanceId: number)
    {
        const instance = await this.resourcesController.QueryResource(instanceId);
        if(instance === undefined)
            return false; //instance was deleted

        const hd = await this.healthController.QueryInstanceHealthData(instance.id);
        if(hd!.status !== HealthStatus.Up)
            return false; //instance is not reachable so can't perform health test

        try
        {
            await this.resourceProviderManager.CheckInstanceHealth(instance.name);
        }
        catch(e)
        {
            await this.healthController.UpdateInstanceHealth(instance.id, HealthStatus.Corrupt, e);
            const userGroupId = await this.FindGroupAssociatedWithInstance(instance);
            await this.notificationsManager.SendErrorNotification(userGroupId, "Instance health check failed", e);
            return false;
        }

        await this.healthController.UpdateInstanceHealth(instance.id, HealthStatus.Up);
        return true;
    }

    private async FindGroupAssociatedWithInstance(resource: Resource)
    {
        //TODO: instances would need an owner or creator
        const groups = await this.userGroupsController.QueryUserGroups();
        return groups[0].id;
    }

    private async ScheduleInstanceCheck(instanceId: number)
    {
        const schedule = await this.resourceProviderManager.RetrieveInstanceCheckSchedule(instanceId);
        if(schedule === null)
            return;

        const hd = await this.healthController.QueryInstanceHealthData(instanceId);
        const lastSuccessfulCheck = hd?.lastSuccessfulCheck ?? new Date(0);

        this.taskScheduler.ScheduleWithOverdueProtection(lastSuccessfulCheck, schedule, this.OnInstanceCheckScheduled.bind(this, instanceId));
    }

    //Event handlers
    private async OnInstanceCheckScheduled(instanceId: number)
    {
        const checkResult = await this.CheckInstance(instanceId);
        if(checkResult)
            this.ScheduleInstanceCheck(instanceId);
    }
}