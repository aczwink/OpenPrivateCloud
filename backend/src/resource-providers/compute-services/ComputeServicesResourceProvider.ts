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
import { DeploymentContext, DeploymentResult, ResourceCheckResult, ResourceCheckType, ResourceDeletionError, ResourceProvider, ResourceState, ResourceTypeDefinition } from "../ResourceProvider";
import { resourceProviders } from "openprivatecloud-common";
import { VirtualMachineManager } from "./VirtualMachineManager";
import { ContainerAppServiceManager } from "./ContainerAppServiceManager";
import { ComputeServicesProperties } from "./Properties";
import { DockerManager } from "./DockerManager";
import { ResourceReference } from "../../common/ResourceReference";
import { DataSourcesProvider } from "../../services/ClusterDataProvider";
import { HealthStatus } from "../../data-access/HealthController";
 
@Injectable
export class ComputeServicesResourceProvider implements ResourceProvider<ComputeServicesProperties>
{
    constructor(private virtualMachineManager: VirtualMachineManager,
        private dockerContainerManager: ContainerAppServiceManager, private dockerManager: DockerManager)
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
                dataIntegrityCheckSchedule: null,
                requiredModules: [],
                schemaName: "DockerContainerProperties"
            },
            {
                dataIntegrityCheckSchedule: null,
                fileSystemType: "ext4",
                requiredModules: [],
                schemaName: "VirtualMachineProperties"
            }
        ];
    }

    //Public methods
    public async CheckResource(resourceReference: ResourceReference, type: ResourceCheckType): Promise<HealthStatus | ResourceCheckResult>
    {
        return HealthStatus.Up;
    }
    
    public async DeleteResource(resourceReference: ResourceReference): Promise<ResourceDeletionError | null>
    {
        switch(resourceReference.resourceTypeName)
        {
            case resourceProviders.computeServices.dockerContainerResourceType.name:
                return await this.dockerContainerManager.DeleteResource(resourceReference);
            case resourceProviders.computeServices.virtualMachineResourceType.name:
                return await this.virtualMachineManager.DeleteResource(resourceReference);
        }

        return null;
    }

    public async ExternalResourceIdChanged(resourceReference: ResourceReference, oldExternalResourceId: string): Promise<void>
    {
    }

    public async ResourcePermissionsChanged(resourceReference: ResourceReference): Promise<void>
    {
    }

    public async ProvideResource(instanceProperties: ComputeServicesProperties, context: DeploymentContext): Promise<DeploymentResult>
    {
        switch(instanceProperties.type)
        {
            case "docker-container":
                await this.dockerManager.EnsureDockerIsInstalled(context.hostId);
                await this.dockerContainerManager.ProvideResource(instanceProperties, context);
                break;
            case "virtual-machine":
                await this.virtualMachineManager.ProvideResource(instanceProperties, context);
                break;
        }

        return {};
    }

    public async QueryResourceState(resourceReference: ResourceReference): Promise<ResourceState>
    {
        switch(resourceReference.resourceTypeName)
        {
            case resourceProviders.computeServices.dockerContainerResourceType.name:
                return await this.dockerContainerManager.QueryResourceState(resourceReference);
            case resourceProviders.computeServices.virtualMachineResourceType.name:
                return await this.virtualMachineManager.QueryResourceState(resourceReference);
        }
        return ResourceState.Running;
    }

    public RehostResource(resourceReference: ResourceReference, targetProperties: ComputeServicesProperties, context: DeploymentContext): Promise<void>
    {
        throw new Error("Method not implemented.");
    }

    public async RequestDataProvider(resourceReference: ResourceReference): Promise<DataSourcesProvider | null>
    {
        return null;
    }
}