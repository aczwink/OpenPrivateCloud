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
import { DeploymentContext, DeploymentResult, ResourceDeletionError, ResourceProvider, ResourceTypeDefinition } from "../ResourceProvider";
import { resourceProviders } from "openprivatecloud-common";
import { InstancesManager } from "../../services/InstancesManager";
import { VirtualMachineManager } from "./VirtualMachineManager";
import { InstanceContext } from "../../common/InstanceContext";
import { DockerManager } from "./DockerManager";
import { ComputeServicesProperties } from "./Properties";
 
@Injectable
export class ComputeServicesResourceProvider implements ResourceProvider<ComputeServicesProperties>
{
    constructor(private instancesManager: InstancesManager, private virtualMachineManager: VirtualMachineManager, private dockerManager: DockerManager)
    {
    }

    //Properties
    public get name(): string
    {
        return resourceProviders.computeServices.name;
    }

    public get resourceTypeDefinitions(): ResourceTypeDefinition[]
    {
        return [
            {
                fileSystemType: "btrfs",
                healthCheckSchedule: null,
                schemaName: "DockerContainerProperties"
            },
            {
                healthCheckSchedule: null,
                fileSystemType: "ext4",
                schemaName: "VirtualMachineProperties"
            }
        ];
    }

    //Public methods
    public async CheckInstanceAvailability(hostId: number, fullInstanceName: string): Promise<void>
    {
    }

    public async CheckInstanceHealth(hostId: number, fullInstanceName: string): Promise<void>
    {
    }
    
    public async DeleteResource(instanceContext: InstanceContext): Promise<ResourceDeletionError | null>
    {
        const parts = this.instancesManager.ExtractPartsFromFullInstanceName(instanceContext.fullInstanceName);
        switch(parts.resourceTypeName)
        {
            case resourceProviders.computeServices.dockerContainerResourceType.name:
                return await this.dockerManager.DeleteResource(instanceContext.hostId, parts.instanceName);
                break;
            case resourceProviders.computeServices.virtualMachineResourceType.name:
                return await this.virtualMachineManager.DeleteResource(instanceContext);
        }

        return null;
    }

    public async InstancePermissionsChanged(instanceContext: InstanceContext): Promise<void>
    {
    }

    public async ProvideResource(instanceProperties: ComputeServicesProperties, context: DeploymentContext): Promise<DeploymentResult>
    {
        switch(instanceProperties.type)
        {
            case "docker-container":
                await this.dockerManager.ProvideResource(instanceProperties, context);
                break;
            case "virtual-machine":
                await this.virtualMachineManager.ProvideResource(instanceProperties, context);
                break;
        }

        return {};
    }
}