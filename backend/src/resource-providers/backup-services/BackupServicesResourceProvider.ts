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
import { BackupVaultProperties } from "./BackupVaultProperties";
import { resourceProviders } from "openprivatecloud-common";
import { ModulesManager } from "../../services/ModulesManager";
import { BackupVaultManager } from "./BackupVaultManager";

@Injectable
export class BackupServicesResourceProvider implements ResourceProvider<BackupVaultProperties>
{
    constructor(private modulesManager: ModulesManager, private backupVaultManager: BackupVaultManager)
    {
    }

    //Properties
    public get name(): string
    {
        return resourceProviders.backupServices.name;
    }

    public get resourceTypeDefinitions(): ResourceTypeDefinition[]
    {
        return [
            {
                healthCheckSchedule: null,
                fileSystemType: "btrfs",
                schemaName: "BackupVaultProperties"
            }
        ];
    }

    //Public methods
    public async CheckInstanceAvailability(hostId: number, fullInstanceName: string): Promise<void>
    {
        this.backupVaultManager.EnsureBackupTimerIsRunningIfConfigured(fullInstanceName);
    }

    public async CheckInstanceHealth(hostId: number, fullInstanceName: string): Promise<void>
    {
    }
    
    public async DeleteResource(hostId: number, hostStoragePath: string, fullInstanceName: string): Promise<ResourceDeletionError | null>
    {
        return null;
    }

    public async InstancePermissionsChanged(hostId: number, fullInstanceName: string): Promise<void>
    {
    }

    public async ProvideResource(instanceProperties: BackupVaultProperties, context: DeploymentContext): Promise<DeploymentResult>
    {
        await this.modulesManager.EnsureModuleIsInstalled(context.hostId, "webdav");
        
        //this is a virtual resource
        return {};
    }
}