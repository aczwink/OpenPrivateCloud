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
import { HostStoragesController } from "../../data-access/HostStoragesController";
import { InstanceLogsController } from "../../data-access/InstanceLogsController";
import { ResourcesController } from "../../data-access/ResourcesController";
import { ProcessTracker, ProcessTrackerManager } from "../../services/ProcessTrackerManager";
import { BackupVaultRetentionConfig, BackupVaultSourcesConfig, BackupVaultTargetConfig } from "./models";
import { BackupTargetMountService, MountedBackupTarget } from "./BackupTargetMountService";
import { FileStorageBackupProcessService } from "./FileStorageBackupProcessService";
import { DatabaseBackupProcessService } from "./DatabaseBackupProcessService";

 
@Injectable
export class BackupProcessService
{
    constructor(private processTrackerManager: ProcessTrackerManager, private instancesController: ResourcesController,
        private hostStoragesController: HostStoragesController, private instanceLogsController: InstanceLogsController,
        private backupTargetMountService: BackupTargetMountService,
        private fileStorageBackupProcessService: FileStorageBackupProcessService,
        private databaseBackupProcessService: DatabaseBackupProcessService)
    {
    }
    
    //Public methods
    public async DeleteBackupsThatAreOlderThanRetentionPeriod(instanceId: number, sources: BackupVaultSourcesConfig, target: BackupVaultTargetConfig, retention: BackupVaultRetentionConfig)
    {
        const instance = await this.instancesController.QueryResource(instanceId);
        const storage = await this.hostStoragesController.RequestHostStorage(instance!.storageId);

        const processTracker = await this.processTrackerManager.Create(storage!.hostId, "Deleting old backups of: " + instance!.name);

        const hostId = storage!.hostId;
        const mountStatus = await this.backupTargetMountService.MountTarget(hostId, target, processTracker);

        try
        {
            for (const fileStorage of sources.fileStorages)
                await this.fileStorageBackupProcessService.DeleteSnapshotsThatAreOlderThanRetentionPeriod(hostId, fileStorage, mountStatus.targetPath, mountStatus.targetFileSystemType, retention, processTracker);
            for (const database of sources.databases)
                await this.databaseBackupProcessService.DeleteSnapshotsThatAreOlderThanRetentionPeriod(hostId, database, mountStatus.targetPath, mountStatus.targetFileSystemType, retention, mountStatus.encryptionPassphrase, processTracker);
        }
        catch(e)
        {
            processTracker.Fail(e);
            throw e;
        }
        finally
        {
            await mountStatus.Unmount();
        }

        processTracker.Add("Finished deleting old backups");
        processTracker.Finish();
    }

    public async RunBackup(instanceId: number, sources: BackupVaultSourcesConfig, target: BackupVaultTargetConfig)
    {
        const instance = await this.instancesController.QueryResource(instanceId);
        const storage = await this.hostStoragesController.RequestHostStorage(instance!.storageId);

        const processTracker = await this.processTrackerManager.Create(storage!.hostId, "Backup of: " + instance!.name);
        try
        {
            await this.MountAndDoBackup(storage!.hostId, sources, target, processTracker);
        }
        catch(e)
        {
            processTracker.Fail(e);
            await this.instanceLogsController.AddInstanceLog(instanceId, processTracker);
            throw e;
        }

        processTracker.Add("Backup process finished");
        processTracker.Finish();
        await this.instanceLogsController.AddInstanceLog(instanceId, processTracker);
    }

    //Private methods
    private async DoBackup(hostId: number, sources: BackupVaultSourcesConfig, mountStatus: MountedBackupTarget, processTracker: ProcessTracker)
    {
        for (const fileStorage of sources.fileStorages)
            await this.fileStorageBackupProcessService.BackupFileStorage(hostId, fileStorage, mountStatus.targetPath, mountStatus.targetFileSystemType, mountStatus.encryptionPassphrase, processTracker);
        for (const database of sources.databases)
            await this.databaseBackupProcessService.BackupDatabase(hostId, database, mountStatus.targetPath, mountStatus.targetFileSystemType, mountStatus.encryptionPassphrase, processTracker);
    }

    private async MountAndDoBackup(hostId: number, sources: BackupVaultSourcesConfig, target: BackupVaultTargetConfig, processTracker: ProcessTracker)
    {
        const mountStatus = await this.backupTargetMountService.MountTarget(hostId, target, processTracker);

        try
        {
            await this.DoBackup(hostId, sources, mountStatus, processTracker);
        }
        finally
        {
            await mountStatus.Unmount();
        }
    }
}