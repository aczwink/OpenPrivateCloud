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
import { InstancePermission, InstancesController } from "../data-access/InstancesController";
import { PermissionsController } from "../data-access/PermissionsController";
import { HostUsersManager } from "./HostUsersManager";
  
@Injectable
export class PermissionsManager
{
    constructor(private instancesController: InstancesController, private permissionsController: PermissionsController, private hostUsersManager: HostUsersManager)
    {
    }
    
    //Public methods
    public async AddInstancePermission(fullInstanceName: string, instancePermission: InstancePermission)
    {
        const hostId = await this.instancesController.QueryHostIdOfInstance(fullInstanceName);
        const userGroupIds = await this.permissionsController.QueryGroupsAssociatedWithHost(hostId!);

        await this.instancesController.AddInstancePermission(fullInstanceName, instancePermission);

        if(!userGroupIds.has(instancePermission.userGroupId))
            await this.hostUsersManager.SyncGroupToHost(hostId!, instancePermission.userGroupId);
    }

    public async DeleteInstancePermission(fullInstanceName: string, instancePermission: InstancePermission)
    {        
        await this.instancesController.DeleteInstancePermission(fullInstanceName, instancePermission);

        const hostId = await this.instancesController.QueryHostIdOfInstance(fullInstanceName);
        const userGroupIds = await this.permissionsController.QueryGroupsAssociatedWithHost(hostId!);

        if(!userGroupIds.has(instancePermission.userGroupId))
            await this.hostUsersManager.RemoveGroupFromHost(hostId!, instancePermission.userGroupId);
    }
}