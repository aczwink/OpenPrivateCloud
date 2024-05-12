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
import { PermissionsController } from "../data-access/PermissionsController";
import { UserGroupsController } from "../data-access/UserGroupsController";
import { ResourceProviderManager } from "./ResourceProviderManager";
import { ResourcesManager } from "./ResourcesManager";


@Injectable
export class UserGroupsManager
{
    constructor(private userGroupsController: UserGroupsController, private permissionsController: PermissionsController,
        private resourceProviderManager: ResourceProviderManager, private resourcesManager: ResourcesManager)
    {
    }

    //Public methods
    public async AddMember(userGroupId: number, userId: number)
    {
        await this.userGroupsController.AddMember(userGroupId, userId);
        await this.RefreshResourcePermissionsOfGroup(userGroupId);
    }

    public async RemoveMembership(userGroupId: number, userId: number)
    {
        await this.userGroupsController.RemoveMembership(userGroupId, userId);
        await this.RefreshResourcePermissionsOfGroup(userGroupId);
    }

    //Private methods
    private async RefreshResourcePermissionsOfGroup(userGroupId: number)
    {
        //TODO: cluster level
        //TODO: RG level
        const resourceIds = await this.permissionsController.QueryResourceIdsAssociatedWithGroup(userGroupId);
        for (const resourceId of resourceIds)
        {
            const ref = await this.resourcesManager.CreateResourceReference(resourceId);
            await this.resourceProviderManager.ResourcePermissionsChanged(ref!);
        }
    }
}