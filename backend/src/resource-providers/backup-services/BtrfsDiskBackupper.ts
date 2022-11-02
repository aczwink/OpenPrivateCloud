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
import path from "path";
import { HostStoragesController } from "../../data-access/HostStoragesController";
import { InstancesController } from "../../data-access/InstancesController";
import { InstancesManager } from "../../services/InstancesManager";
import { MountsManager } from "../../services/MountsManager";
import { ProcessTracker } from "../../services/ProcessTrackerManager";
import { RemoteCommandExecutor } from "../../services/RemoteCommandExecutor";
import { RemoteFileSystemManager } from "../../services/RemoteFileSystemManager";
import { RemoteRootFileSystemManager } from "../../services/RemoteRootFileSystemManager";
import { FileStoragesManager } from "../file-services/FileStoragesManager";
import { BackupVaultFileStorageConfig, BackupVaultSourcesConfig } from "./models";

export class BtrfsDiskBackupper
{
    constructor(private processTracker: ProcessTracker,
        private mountsManager: MountsManager, private fileStoragesManager: FileStoragesManager, private instancesController: InstancesController,
        private hostStoragesController: HostStoragesController, private remoteFileSystemManager: RemoteFileSystemManager, private instancesManager: InstancesManager,
        private remoteRootFileSystemManager: RemoteRootFileSystemManager, private remoteCommandExecutor: RemoteCommandExecutor)
    {
        this.didMount = false;
        this.targetMountPoint = "";
    }

    //Public methods
    public async Backup(hostId: number, sources: BackupVaultSourcesConfig, targetStorageDevicePath: string)
    {
        await this.MountIfRequired(hostId, targetStorageDevicePath);

        for (const fileStorage of sources.fileStorages)
            await this.BackupFileStorage(hostId, fileStorage);

        if(this.didMount)
        {
            await this.mountsManager.UnmountAndRemoveMountPoint(hostId, targetStorageDevicePath);
            this.processTracker.Add("Device", targetStorageDevicePath, "unmounted.");
        }

        this.processTracker.Add("Backup process finished");
    }

    //Private variables
    private didMount: boolean;
    private targetMountPoint: string;

    //Private methods
    private async BackupFileStorage(hostId: number, fileStorage: BackupVaultFileStorageConfig)
    {
        const instance = await this.instancesController.QueryInstance(fileStorage.fullInstanceName);
        if(instance === undefined)
        {
            this.processTracker.Add("ERROR! FileStorage not found:", fileStorage.fullInstanceName);
            return;
        }
        const storage = await this.hostStoragesController.RequestHostStorage(instance.storageId);
        const storagePath = storage!.path;

        if(fileStorage.createSnapshotBeforeBackup)
        {
            this.processTracker.Add("Creating snapshot for FileStorage", fileStorage.fullInstanceName);
            await this.fileStoragesManager.CreateSnapshot(hostId, storagePath, fileStorage.fullInstanceName);
        }

        const sourceSnapshots = (await this.fileStoragesManager.QuerySnapshotsRawOrdered(hostId, storagePath, fileStorage.fullInstanceName)).ToArray();

        const targetDir = this.instancesManager.BuildInstanceStoragePath(this.targetMountPoint, fileStorage.fullInstanceName);
        await this.remoteRootFileSystemManager.CreateDirectory(hostId, targetDir);
        
        const targetSnapshots = (await this.remoteFileSystemManager.ListDirectoryContents(hostId, targetDir))
            .Values().Map(x => x.filename).ToSet();

        const toBeSynced = sourceSnapshots.Values().Filter(x => !targetSnapshots.has(x)).OrderBy(x => x).ToArray();
        for (const snapshotName of toBeSynced)
        {
            const idx = sourceSnapshots.indexOf(snapshotName);
            const prevSnapshotName = sourceSnapshots[idx - 1];

            const cmdExtra = [];

            if(idx === 0)
            {
                this.processTracker.Add("Backing up snapshot", snapshotName);
            }
            else
            {
                this.processTracker.Add("Backing up snapshot", snapshotName, "with predecessor", prevSnapshotName);

                const prevSourceDir = path.join(this.fileStoragesManager.GetSnapshotsPath(storagePath, fileStorage.fullInstanceName), prevSnapshotName);
                cmdExtra.push("-p", prevSourceDir);
            }

            const sourceDir = path.join(this.fileStoragesManager.GetSnapshotsPath(storagePath, fileStorage.fullInstanceName), snapshotName);

            await this.remoteCommandExecutor.ExecuteCommand({
                type: "pipe",
                sudo: true,
                source: ["btrfs", "send", ...cmdExtra, sourceDir],
                target: ["btrfs", "receive", targetDir]
            }, hostId);

            this.processTracker.Add("Finished copying snapshot", snapshotName);
        }
    }

    private async MountIfRequired(hostId: number, targetStorageDevicePath: string)
    {
        const mountPoint = await this.mountsManager.QueryMountPoint(hostId, targetStorageDevicePath);
        if(mountPoint === undefined)
        {
            this.targetMountPoint = await this.mountsManager.CreateUniqueLocationAndMount(hostId, targetStorageDevicePath);
            this.didMount = true;

            this.processTracker.Add("Mounted", targetStorageDevicePath, "on", this.targetMountPoint);
        }
        else
        {
            this.targetMountPoint = mountPoint;

            this.processTracker.Add("Device", targetStorageDevicePath, "already mounted on", this.targetMountPoint);
        }
    }
}