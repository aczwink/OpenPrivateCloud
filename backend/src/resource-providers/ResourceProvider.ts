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

import { ResourceReference } from "../common/ResourceReference";
import { TimeSchedule } from "../common/TimeSchedule";
import { HealthStatus } from "../data-access/HealthController";
import { ModuleName } from "../distro/DistroPackageManager";
import { DataSourcesProvider } from "../services/ClusterDataProvider";

export interface BaseResourceProperties
{
    type: string;
    name: string;

    /**
     * @title Hostname
     * @format hostName
     */
    hostName: string;
}

export interface ResourceTypeDefinition
{
    dataIntegrityCheckSchedule: TimeSchedule | null;
    fileSystemType: "btrfs" | "ext4";
    requiredModules: ModuleName[];
    schemaName: string;
}

export interface ResourceCheckResult
{
    status: HealthStatus;
    context: string;
}

export enum ResourceCheckType
{
    /**
     * A quick check whether the service is functional. The resource shall not be altered.
     */
    Availability,
    /**
     * A more intensive check of the service. This will be executed in case the availability check signaled corruption. Auto remediation steps in order to re-establish operatability should be performed if necessary.
     */
    ServiceHealth,
    /**
     * An intensive check of whether data of the service has not been tampered with. This does not include service configuration files or so but only real user data.
     */
    DataIntegrity
}

export interface ResourceDeletionError
{
    type: "ConflictingState";
    message: string;
}

export interface DeploymentContext
{
    resourceReference: ResourceReference;
    hostId: number;
    storagePath: string
    userId: number;
}

export interface DeploymentResult
{
    config?: any;
}

export enum ResourceState
{
    Running = 1,
    Stopped = 2,
    Waiting = 3
}

export interface ResourceProvider<PropertiesType extends BaseResourceProperties>
{
    readonly name: string;
    readonly resourceTypeDefinitions: ResourceTypeDefinition[];

    CheckResource(resourceReference: ResourceReference, type: ResourceCheckType): Promise<HealthStatus | ResourceCheckResult>;
    DeleteResource(resourceReference: ResourceReference): Promise<ResourceDeletionError | null>;
    ExternalResourceIdChanged(resourceReference: ResourceReference, oldExternalResourceId: string): Promise<void>;
    ResourcePermissionsChanged(resourceReference: ResourceReference): Promise<void>;
    ProvideResource(instanceProperties: PropertiesType, context: DeploymentContext): Promise<DeploymentResult>;
    QueryResourceState(resourceReference: ResourceReference): Promise<ResourceState>;
    RequestDataProvider(resourceReference: ResourceReference): Promise<DataSourcesProvider | null>;
}