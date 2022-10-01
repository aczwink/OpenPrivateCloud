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
import { InstancesManager } from "../../services/InstancesManager";
import { DeploymentContext, ResourceProvider, ResourceTypeDefinition } from "../ResourceProvider";
import { c_fileServicesResourceProviderName } from "./constants";
import { FileStorageProperties } from "./FileStorageProperties";

@Injectable
export class FileServicesResourceProvider implements ResourceProvider<FileStorageProperties>
{
    constructor(private instancesManager: InstancesManager)
    {
    }
    
    //Properties
    public get name(): string
    {
        return c_fileServicesResourceProviderName;
    }

    public get resourceTypeDefinitions(): ResourceTypeDefinition[]
    {
        return [
            {
                fileSystemType: "btrfs",
                schemaName: "FileStorageProperties"
            }
        ];
    }

    //Public methods
    public async DeleteResource(hostId: number, hostStoragePath: string, fullInstanceName: string): Promise<void>
    {
        await this.instancesManager.RemoveInstanceStorageDirectory(hostId, hostStoragePath, fullInstanceName);
    }

    public async ProvideResource(instanceProperties: FileStorageProperties, context: DeploymentContext): Promise<void>
    {
        await this.instancesManager.CreateInstanceStorageDirectory(context.hostId, context.storagePath, context.fullInstanceName, context.userId);
    }
}