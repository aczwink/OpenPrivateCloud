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
import { ModulesManager } from "../../services/ModulesManager";
import { DeploymentContext, DeploymentResult, ResourceDeletionError, ResourceProvider, ResourceTypeDefinition } from "../ResourceProvider";
import { resourceProviders } from "openprivatecloud-common";
import { FileStorageProperties } from "./FileStorageProperties";
import { FileStoragesManager } from "./FileStoragesManager";
import { RemoteCommandExecutor } from "../../services/RemoteCommandExecutor";
import { RemoteFileSystemManager } from "../../services/RemoteFileSystemManager";
import { InstanceContext } from "../../common/InstanceContext";

@Injectable
export class FileServicesResourceProvider implements ResourceProvider<FileStorageProperties>
{
    constructor(private instancesManager: InstancesManager, private modulesManager: ModulesManager, private fileStoragesManager: FileStoragesManager,
        private remoteCommandExecutor: RemoteCommandExecutor, private remoteFileSystemManager: RemoteFileSystemManager)
    {
    }
    
    //Properties
    public get name(): string
    {
        return resourceProviders.fileServices.name;
    }

    public get resourceTypeDefinitions(): ResourceTypeDefinition[]
    {
        return [
            {
                healthCheckSchedule: null,
                fileSystemType: "btrfs",
                schemaName: "FileStorageProperties"
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
        await this.fileStoragesManager.UpdateSMBConfig(instanceContext, { enabled: false });
        await this.fileStoragesManager.DeleteAllSnapshots(instanceContext);
        await this.instancesManager.RemoveInstanceStorageDirectory(instanceContext.hostId, instanceContext.hostStoragePath, instanceContext.fullInstanceName);

        return null;
    }

    public async InstancePermissionsChanged(instanceContext: InstanceContext): Promise<void>
    {
        await this.fileStoragesManager.RefreshPermissions(instanceContext);
    }

    public async ProvideResource(instanceProperties: FileStorageProperties, context: DeploymentContext): Promise<DeploymentResult>
    {
        await this.modulesManager.EnsureModuleIsInstalled(context.hostId, "samba");
        const instancePath = await this.instancesManager.CreateInstanceStorageDirectory(context.hostId, context.storagePath, context.fullInstanceName);
        await this.remoteFileSystemManager.ChangeMode(context.hostId, instancePath, 0o775);

        const dataPath = this.fileStoragesManager.GetDataPath(context.storagePath, context.fullInstanceName);
        const snapshotsPath = this.fileStoragesManager.GetSnapshotsPath(context.storagePath, context.fullInstanceName);

        await this.remoteCommandExecutor.ExecuteCommand(["btrfs", "subvolume", "create", dataPath], context.hostId);
        await this.remoteFileSystemManager.ChangeMode(context.hostId, dataPath, 0o770);

        await this.remoteFileSystemManager.CreateDirectory(context.hostId, snapshotsPath);
        await this.remoteFileSystemManager.ChangeMode(context.hostId, snapshotsPath, 0o750);

        return {};
    }
}