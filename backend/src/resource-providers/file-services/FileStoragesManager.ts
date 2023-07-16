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
import path from "path";
import { Injectable } from "acts-util-node";
import { ResourcesManager } from "../../services/ResourcesManager";
import { RemoteFileSystemManager } from "../../services/RemoteFileSystemManager";
import { RemoteCommandExecutor } from "../../services/RemoteCommandExecutor";
import { InstanceConfigController } from "../../data-access/InstanceConfigController";
import { InstanceContext } from "../../common/InstanceContext";
import { SingleSMBSharePerInstanceProvider } from "./SingleSMBSharePerInstanceProvider";
import { SharedFolderPermissionsManager } from "./SharedFolderPermissionsManager";
import { ResourceReference } from "../../common/InstanceReference";

interface SMBConfig
{
    enabled: boolean;
    /**
     * Degrades performance but should be enabled when connecting over unsecure networks or when sensitive data is transferred.
     */
    transportEncryption: boolean;
}

export interface FileStorageConfig
{
    smb: SMBConfig;
    snapshotRetentionDays?: number;
};

@Injectable
export class FileStoragesManager
{
    constructor(private instancesManager: ResourcesManager, private sharedFolderPermissionsManager: SharedFolderPermissionsManager,
        private remoteFileSystemManager: RemoteFileSystemManager,
        private remoteCommandExecutor: RemoteCommandExecutor, private instanceConfigController: InstanceConfigController,
        private singleSMBSharePerInstanceProvider: SingleSMBSharePerInstanceProvider)
    {
    }
    
    //Public methods
    public async CreateSnapshot(resourceReference: ResourceReference)
    {
        await this.DeleteSnapshotsThatAreOlderThanRetentionPeriod(resourceReference);

        const dataPath = this.GetDataPath(resourceReference.hostStoragePath, resourceReference.externalId);
        const snapsPath = this.GetSnapshotsPath(resourceReference.hostStoragePath, resourceReference.externalId);
        const snapName = new Date().toISOString();
        const fullSnapPath = path.join(snapsPath, snapName);
        
        await this.remoteCommandExecutor.ExecuteCommand(["btrfs", "subvolume", "snapshot", "-r", dataPath, fullSnapPath], resourceReference.hostId);
        await this.remoteCommandExecutor.ExecuteCommand(["sync"], resourceReference.hostId);
    }

    public async DeleteAllSnapshots(resourceReference: ResourceReference)
    {
        const snapshots = await this.QuerySnapshotsOrdered(resourceReference.hostId, resourceReference.hostStoragePath, resourceReference.externalId);
        for (const snapshot of snapshots)
            await this.DeleteSnapshot(resourceReference, snapshot.snapshotName);
    }

    public async DeleteSnapshotsThatAreOlderThanRetentionPeriod(resourceReference: ResourceReference)
    {
        const config = await this.ReadConfig(resourceReference.id);
        if(config.snapshotRetentionDays === undefined)
            return;

        const msToDay = 1000 * 60 * 60 * 24;
        const currentDay = Date.now() / msToDay;

        const snapshots = await this.QuerySnapshotsOrdered(resourceReference.hostId, resourceReference.hostStoragePath, resourceReference.externalId);
        for (const snapshot of snapshots)
        {
            const snapshotDay = snapshot.creationDate.valueOf() / msToDay;
            if((snapshotDay + config.snapshotRetentionDays) < currentDay)
            {
                await this.DeleteSnapshot(resourceReference, snapshot.snapshotName);
            }
        }
    }

    public GetDataPath(storagePath: string, fullInstanceName: string)
    {
        const instancePath = this.instancesManager.BuildInstanceStoragePath(storagePath, fullInstanceName);
        return path.join(instancePath, "data");
    }

    public async GetSMBConnectionInfo(data: InstanceContext, userId: number)
    {
        return await this.singleSMBSharePerInstanceProvider.GetSMBConnectionInfo(data, userId);
    }

    public GetSnapshotsPath(storagePath: string, fullInstanceName: string)
    {
        const instancePath = this.instancesManager.BuildInstanceStoragePath(storagePath, fullInstanceName);
        return path.join(instancePath, "snapshots");
    }

    public async QuerySnapshotsOrdered(hostId: number, storagePath: string, fullInstanceName: string)
    {
        const snapsPath = this.GetSnapshotsPath(storagePath, fullInstanceName);

        const snapshots = await this.remoteFileSystemManager.ListDirectoryContents(hostId, snapsPath);
        return snapshots.Values().OrderBy(x => x).Map(x => ({
            snapshotName: x,
            creationDate: new Date(x)
        }));
    }

    public async ReadConfig(instanceId: number): Promise<FileStorageConfig>
    {
        const config = await this.instanceConfigController.QueryConfig<FileStorageConfig>(instanceId);
        if(config === undefined)
        {
            return {
                smb: {
                    enabled: false,
                    transportEncryption: false
                }
            };
        }
        return config;
    }

    public async RefreshPermissions(resourceReference: ResourceReference)
    {
        const dataPath = this.GetDataPath(resourceReference.hostStoragePath, resourceReference.externalId);
        await this.sharedFolderPermissionsManager.SetPermissions(resourceReference, dataPath, false);

        const cfg = await this.ReadConfig(resourceReference.id);
        await this.UpdateConfig(resourceReference, cfg);
    }
    
    public async UpdateConfig(resourceReference: ResourceReference, config: FileStorageConfig)
    {
        const result = await this.singleSMBSharePerInstanceProvider.UpdateSMBConfig({
            enabled: config.smb.enabled,
            sharePath: this.GetDataPath(resourceReference.hostStoragePath, resourceReference.externalId),
            readOnly: false,
            transportEncryption: config.smb.transportEncryption,
        }, resourceReference);
        if(result !== undefined)
            return result;

        await this.WriteConfig(resourceReference.id, config);

        await this.DeleteSnapshotsThatAreOlderThanRetentionPeriod(resourceReference);
    }

    //Private methods
    private async DeleteSnapshot(resourceReference: ResourceReference, snapshotName: string)
    {
        const snapshotsPath = this.GetSnapshotsPath(resourceReference.hostStoragePath, resourceReference.externalId);
        const snapshotPath = path.join(snapshotsPath, snapshotName);
        await this.remoteCommandExecutor.ExecuteCommand(["sudo", "btrfs", "subvolume", "delete", snapshotPath], resourceReference.hostId);
    }

    private async WriteConfig(instanceId: number, config: FileStorageConfig)
    {
        await this.instanceConfigController.UpdateOrInsertConfig(instanceId, config);
    }
}