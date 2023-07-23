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
import { Injectable } from "acts-util-node";
import { ResourcesManager } from "../../services/ResourcesManager";
import { ModulesManager } from "../../services/ModulesManager";
import { DeploymentContext, DeploymentResult, ResourceDeletionError, ResourceProvider, ResourceState, ResourceTypeDefinition } from "../ResourceProvider";
import { resourceProviders } from "openprivatecloud-common";
import { FileStorageProperties } from "./FileStorageProperties";
import { FileStoragesManager } from "./FileStoragesManager";
import { RemoteCommandExecutor } from "../../services/RemoteCommandExecutor";
import { RemoteFileSystemManager } from "../../services/RemoteFileSystemManager";
import { ResourceReference } from "../../common/ResourceReference";

@Injectable
export class FileServicesResourceProvider implements ResourceProvider<FileStorageProperties>
{
    constructor(private resourcesManager: ResourcesManager, private modulesManager: ModulesManager, private fileStoragesManager: FileStoragesManager,
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
    public async CheckResourceAvailability(resourceReference: ResourceReference): Promise<void>
    {
    }

    public async CheckResourceHealth(resourceReference: ResourceReference): Promise<void>
    {
    }
    
    public async DeleteResource(resourceReference: ResourceReference): Promise<ResourceDeletionError | null>
    {
        await this.fileStoragesManager.UpdateConfig(resourceReference, {
            smb: { enabled: false, transportEncryption: false }
        });
        await this.fileStoragesManager.DeleteAllSnapshots(resourceReference);
        await this.resourcesManager.RemoveResourceStorageDirectory(resourceReference);

        return null;
    }

    public async ExternalResourceIdChanged(resourceReference: ResourceReference, oldExternalResourceId: string): Promise<void>
    {
        await this.fileStoragesManager.ExternalResourceIdChanged(resourceReference, oldExternalResourceId);
    }

    public async InstancePermissionsChanged(resourceReference: ResourceReference): Promise<void>
    {
        await this.fileStoragesManager.RefreshPermissions(resourceReference);
    }

    public async ProvideResource(instanceProperties: FileStorageProperties, context: DeploymentContext): Promise<DeploymentResult>
    {
        await this.modulesManager.EnsureModuleIsInstalled(context.hostId, "samba");
        const resourcePath = await this.resourcesManager.CreateResourceStorageDirectory(context.resourceReference);
        await this.remoteFileSystemManager.ChangeMode(context.hostId, resourcePath, 0o775);

        const dataPath = this.fileStoragesManager.GetDataPath(context.resourceReference);
        const snapshotsPath = this.fileStoragesManager.GetSnapshotsPath(context.resourceReference);

        await this.remoteCommandExecutor.ExecuteCommand(["btrfs", "subvolume", "create", dataPath], context.hostId);
        await this.remoteFileSystemManager.ChangeMode(context.hostId, dataPath, 0o770);

        await this.remoteFileSystemManager.CreateDirectory(context.hostId, snapshotsPath);
        await this.remoteFileSystemManager.ChangeMode(context.hostId, snapshotsPath, 0o750);

        return {};
    }

    public async QueryResourceState(resourceReference: ResourceReference): Promise<ResourceState>
    {
        return "running";
    }
}