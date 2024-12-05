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
import { ResourceReference } from "../common/ResourceReference";
import { ResourceProviderManager } from "./ResourceProviderManager";
import { ResourceDependenciesController } from "../data-access/ResourceDependenciesController";
import { RoleAssignmentsController } from "../data-access/RoleAssignmentsController";
import { PermissionsManager } from "./PermissionsManager";
import { ResourceConfigController } from "../data-access/ResourceConfigController";
import { HealthController } from "../data-access/HealthController";
import { ResourceLogsController } from "../data-access/ResourceLogsController";
import { ResourcesController } from "../data-access/ResourcesController";
import { ResourceUserCredentialDependenciesController } from "../data-access/ResourceUserCredentialDependenciesController";

@Injectable
export class ResourceDeletionService
{
    constructor(private resourceProviderManager: ResourceProviderManager, private resourceDependenciesController: ResourceDependenciesController, private roleAssignmentsController: RoleAssignmentsController,
        private permissionsManager: PermissionsManager, private instanceConfigController: ResourceConfigController, private healthController: HealthController, private instanceLogsController: ResourceLogsController,
        private resourcesController: ResourcesController, private resourceUserCredentialDependenciesController: ResourceUserCredentialDependenciesController)
    {
    }

    public async DeleteResource(resourceReference: ResourceReference)
    {
        const resourceProvider = this.resourceProviderManager.FindResourceProviderByResource(resourceReference);
        const resourceId = resourceReference.id;

        await this.resourceDependenciesController.DeleteDependenciesOf(resourceId);
        await this.resourceUserCredentialDependenciesController.CleanForResource(resourceId);

        //first everything that the user is also able to do himself
        const roleAssignments = await this.roleAssignmentsController.QueryResourceLevelRoleAssignments(resourceReference.id);
        for (const roleAssignment of roleAssignments)
            await this.permissionsManager.DeleteInstanceRoleAssignment(resourceId, roleAssignment);

        //delete the resource
        const result = await resourceProvider.DeleteResource(resourceReference);
        if(result !== null)
            return result;

        //the resource is now degraded and should not be queried anymore. simply clean up
        await this.instanceConfigController.DeleteConfig(resourceId);
        await this.healthController.DeleteInstanceHealthData(resourceId);
        await this.instanceLogsController.DeleteLogsAssociatedWithInstance(resourceId);

        await this.resourcesController.DeleteResource(resourceReference.id);
        
        return null;
    }
}