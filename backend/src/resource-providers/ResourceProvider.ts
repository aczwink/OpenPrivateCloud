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

import { ResourceReference } from "../common/ResourceReference";
import { TimeSchedule } from "../common/TimeSchedule";

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
    healthCheckSchedule: TimeSchedule | null;
    fileSystemType: "btrfs" | "ext4";
    schemaName: string;
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

export type ResourceState = "corrupt" | "down" | "in deployment" | "running" | "stopped";

export interface ResourceProvider<PropertiesType extends BaseResourceProperties>
{
    readonly name: string;
    readonly resourceTypeDefinitions: ResourceTypeDefinition[];

    CheckResourceAvailability(resourceReference: ResourceReference): Promise<void>;
    CheckResourceHealth(resourceReference: ResourceReference): Promise<void>;
    DeleteResource(resourceReference: ResourceReference): Promise<ResourceDeletionError | null>;
    ExternalResourceIdChanged(resourceReference: ResourceReference, oldExternalResourceId: string): Promise<void>;
    InstancePermissionsChanged(resourceReference: ResourceReference): Promise<void>;
    ProvideResource(instanceProperties: PropertiesType, context: DeploymentContext): Promise<DeploymentResult>;
    QueryResourceState(resourceReference: ResourceReference): Promise<ResourceState>;
}