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
import { DateTime, Injectable } from "acts-util-node";
import { HostStoragesController } from "../../data-access/HostStoragesController";
import { ResourceLogsController } from "../../data-access/ResourceLogsController";
import { ResourcesController } from "../../data-access/ResourcesController";
import { ProcessTracker, ProcessTrackerManager } from "../../services/ProcessTrackerManager";
import { BackupVaultRetentionConfig, BackupVaultSourcesConfig, BackupVaultTargetConfig } from "./models";
import { BackupTargetMountService, MountedBackupTarget } from "./BackupTargetMountService";
import { FileStorageBackupProcessService } from "./processors/FileStorageBackupProcessService";
import { DatabaseBackupProcessService } from "./processors/DatabaseBackupProcessService";
import { ControllerDatabaseServerBackupService } from "./processors/ControllerDatabaseServerBackupService";
import { KeyVaultBackupProcessService } from "./processors/KeyVaultBackupProcessService";
import { OIDPBackupService } from "./processors/OIDPBackupService";

 
@Injectable
export class BackupProcessService
{
    constructor(private processTrackerManager: ProcessTrackerManager, private instancesController: ResourcesController,
        private hostStoragesController: HostStoragesController, private instanceLogsController: ResourceLogsController,
        private backupTargetMountService: BackupTargetMountService, private controllerDatabaseBackupService: ControllerDatabaseServerBackupService,
        private fileStorageBackupProcessService: FileStorageBackupProcessService, private keyVaultBackupProcessService: KeyVaultBackupProcessService,
        private databaseBackupProcessService: DatabaseBackupProcessService,
        private oidpBackupService: OIDPBackupService
    )
    {
    }
    
    //Public methods
    public async DeleteBackupsThatAreOlderThanRetentionPeriod(resourceId: number, sources: BackupVaultSourcesConfig, target: BackupVaultTargetConfig, retention: BackupVaultRetentionConfig)
    {
        const instance = await this.instancesController.QueryResource(resourceId);
        const storage = await this.hostStoragesController.RequestHostStorage(instance!.storageId);

        const processTracker = await this.processTrackerManager.Create(storage!.hostId, "Deleting old backups of: " + instance!.name);

        const hostId = storage!.hostId;
        const mountStatus = await this.backupTargetMountService.MountTarget(hostId, target, processTracker);

        try
        {
            for (const fileStorage of sources.fileStorages)
                await this.fileStorageBackupProcessService.DeleteSnapshotsThatAreOlderThanRetentionPeriod(hostId, fileStorage, mountStatus.targetPath, mountStatus.targetFileSystemType, retention, processTracker);
            for (const database of sources.databases)
                await this.databaseBackupProcessService.DeleteSnapshotsThatAreOlderThanRetentionPeriod(hostId, database, mountStatus.targetPath, mountStatus.targetFileSystemType, retention, mountStatus.encryptionKeyKeyVaultReference, processTracker);
            if(sources.controllerDB.enable)
                await this.controllerDatabaseBackupService.DeleteSnapshotsThatAreOlderThanRetentionPeriod(hostId, mountStatus.targetPath, retention, processTracker);
            if(sources.controllerDB.enableODIP)
                await this.oidpBackupService.DeleteSnapshotsThatAreOlderThanRetentionPeriod(hostId, mountStatus.targetPath, retention, processTracker);
            for(const keyVault of sources.keyVaults)
                await this.keyVaultBackupProcessService.DeleteSnapshotsThatAreOlderThanRetentionPeriod(hostId, mountStatus.targetPath, retention, keyVault, processTracker);
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
        await this.instanceLogsController.DeleteResourceLogsOlderThan(resourceId, DateTime.Now().Subtract({ unit: "days", count: retention.numberOfDays }));
        processTracker.Add("Finished deleting old logs");
        processTracker.Finish();
    }

    public async RunBackup(instanceId: number, sources: BackupVaultSourcesConfig, target: BackupVaultTargetConfig, retention: BackupVaultRetentionConfig)
    {
        const instance = await this.instancesController.QueryResource(instanceId);
        const storage = await this.hostStoragesController.RequestHostStorage(instance!.storageId);

        const processTracker = await this.processTrackerManager.Create(storage!.hostId, "Backup of: " + instance!.name);
        try
        {
            await this.MountAndDoBackup(storage!.hostId, sources, target, retention, processTracker);
        }
        catch(e)
        {
            processTracker.Fail(e);
            await this.instanceLogsController.AddResourceLog(instanceId, processTracker);
            throw e;
        }

        processTracker.Add("Backup process finished");
        processTracker.Finish();
        await this.instanceLogsController.AddResourceLog(instanceId, processTracker);
    }

    //Private methods
    private async DoBackup(hostId: number, sources: BackupVaultSourcesConfig, mountStatus: MountedBackupTarget, retention: BackupVaultRetentionConfig, processTracker: ProcessTracker)
    {
        for (const fileStorage of sources.fileStorages)
            await this.fileStorageBackupProcessService.BackupFileStorage(hostId, fileStorage, mountStatus.targetPath, mountStatus.targetFileSystemType, mountStatus.encryptionKeyKeyVaultReference, retention, processTracker);
        for (const database of sources.databases)
            await this.databaseBackupProcessService.BackupDatabase(hostId, database, mountStatus.targetPath, mountStatus.targetFileSystemType, mountStatus.encryptionKeyKeyVaultReference, processTracker);
        if(sources.controllerDB.enable)
            await this.controllerDatabaseBackupService.BackupDatabase(hostId, mountStatus.targetPath, mountStatus.targetFileSystemType, mountStatus.encryptionKeyKeyVaultReference, processTracker);
        if(sources.controllerDB.enableODIP)
            await this.oidpBackupService.BackupDatabase(hostId, mountStatus.targetPath, mountStatus.targetFileSystemType, mountStatus.encryptionKeyKeyVaultReference, processTracker);
        for(const keyVault of sources.keyVaults)
            await this.keyVaultBackupProcessService.Backup(hostId, keyVault, mountStatus.targetPath, mountStatus.targetFileSystemType, mountStatus.encryptionKeyKeyVaultReference, processTracker);
    }

    private async MountAndDoBackup(hostId: number, sources: BackupVaultSourcesConfig, target: BackupVaultTargetConfig, retention: BackupVaultRetentionConfig, processTracker: ProcessTracker)
    {
        const mountStatus = await this.backupTargetMountService.MountTarget(hostId, target, processTracker);

        try
        {
            await this.DoBackup(hostId, sources, mountStatus, retention, processTracker);
        }
        finally
        {
            await mountStatus.Unmount();
        }
    }
}