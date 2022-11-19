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
import { Injectable } from "acts-util-node";
import { HostStoragesController } from "../../data-access/HostStoragesController";
import { InstanceLogsController } from "../../data-access/InstanceLogsController";
import { InstancesController } from "../../data-access/InstancesController";
import { InstancesManager } from "../../services/InstancesManager";
import { ProcessTracker, ProcessTrackerManager } from "../../services/ProcessTrackerManager";
import { RemoteRootFileSystemManager } from "../../services/RemoteRootFileSystemManager";
import { BackupVaultDatabaseConfig, BackupVaultFileStorageConfig, BackupVaultSourcesConfig, BackupVaultTargetConfig } from "./models";
import { RemoteCommandExecutor } from "../../services/RemoteCommandExecutor";
import { FileStoragesManager } from "../file-services/FileStoragesManager";
import { RemoteFileSystemManager } from "../../services/RemoteFileSystemManager";
import { BackupTargetMountService, TargetFileSystemType } from "./BackupTargetMountService";

 
@Injectable
export class BackupProcessService
{
    constructor(private processTrackerManager: ProcessTrackerManager, private instancesController: InstancesController,
        private hostStoragesController: HostStoragesController, private instanceLogsController: InstanceLogsController,
        private instancesManager: InstancesManager, private remoteRootFileSystemManager: RemoteRootFileSystemManager,
        private remoteCommandExecutor: RemoteCommandExecutor, private fileStoragesManager: FileStoragesManager,
        private remoteFileSystemManager: RemoteFileSystemManager,
        private backupTargetMountService: BackupTargetMountService)
    {
    }
    
    //Public methods
    public async RunBackup(instanceId: number, sources: BackupVaultSourcesConfig, target: BackupVaultTargetConfig)
    {
        const instance = await this.instancesController.QueryInstanceById(instanceId);
        const storage = await this.hostStoragesController.RequestHostStorage(instance!.storageId);

        const hostId = storage!.hostId;

        const processTracker = this.processTrackerManager.Create("Backup of: " + instance!.fullName);
        const mountStatus = await this.backupTargetMountService.MountTarget(hostId, target, processTracker);

        for (const fileStorage of sources.fileStorages)
            await this.BackupFileStorage(hostId, fileStorage, mountStatus.targetPath, mountStatus.targetFileSystemType, processTracker);
        for (const database of sources.databases)
            await this.BackupDatabase(hostId, database, mountStatus.targetPath, mountStatus.targetFileSystemType, processTracker);

        await mountStatus.Unmount();

        processTracker.Add("Backup process finished");
        processTracker.Finish();
        await this.instanceLogsController.AddInstanceLog(instanceId, processTracker);
    }

    //Private methods
    private async BackupDatabase(hostId: number, database: BackupVaultDatabaseConfig, backupTargetPath: string, targetFileSystemType: TargetFileSystemType, processTracker: ProcessTracker)
    {
        const targetPath = this.instancesManager.BuildInstanceStoragePath(backupTargetPath, database.fullInstanceName);
        await this.remoteRootFileSystemManager.CreateDirectory(hostId, targetPath);

        const snapshotFileName = new Date().toISOString() + ".sql.gz";
        const targetSnapshotFileName = this.ReplaceSpecialCharacters(snapshotFileName, targetFileSystemType);

        processTracker.Add("Backing up MariaDB database", database.databaseName);

        const dumpPath = path.join(targetPath, targetSnapshotFileName);
        await this.remoteCommandExecutor.ExecuteCommand({
            source: {
                source: ["mysqldump", "-u", "root", database.databaseName],
                target: ["gzip"],
                type: "pipe",
            },
            target: [dumpPath],
            type: "redirect-stdout",
            sudo: true
        }, hostId);
    }

    private async BackupFileStorage(hostId: number, fileStorage: BackupVaultFileStorageConfig, backupTargetPath: string, targetFileSystemType: TargetFileSystemType, processTracker: ProcessTracker)
    {
        const instance = await this.instancesController.QueryInstance(fileStorage.fullInstanceName);
        if(instance === undefined)
        {
            processTracker.Add("ERROR! FileStorage not found:", fileStorage.fullInstanceName);
            return;
        }
        const storage = await this.hostStoragesController.RequestHostStorage(instance.storageId);
        const storagePath = storage!.path;

        if(fileStorage.createSnapshotBeforeBackup)
        {
            processTracker.Add("Creating snapshot for FileStorage", fileStorage.fullInstanceName);
            await this.fileStoragesManager.CreateSnapshot(hostId, storagePath, fileStorage.fullInstanceName);
        }

        const sourceSnapshots = (await this.fileStoragesManager.QuerySnapshotsRawOrdered(hostId, storagePath, fileStorage.fullInstanceName)).ToArray();

        const targetDir = this.instancesManager.BuildInstanceStoragePath(backupTargetPath, fileStorage.fullInstanceName);
        await this.remoteRootFileSystemManager.CreateDirectory(hostId, targetDir);
        
        const targetSnapshots = (await this.remoteFileSystemManager.ListDirectoryContents(hostId, targetDir))
            .Values().Map(x => x.filename).ToSet();

        const toBeSynced = sourceSnapshots.Values().Filter(x => !this.DoesTargetSnapshotExist(x, targetSnapshots, targetFileSystemType)).OrderBy(x => x).ToArray();
        for (const snapshotName of toBeSynced)
        {
            const idx = sourceSnapshots.indexOf(snapshotName);
            const prevSnapshotName = sourceSnapshots[idx - 1];

            const sourceDir = path.join(this.fileStoragesManager.GetSnapshotsPath(storagePath, fileStorage.fullInstanceName), snapshotName);

            if(idx === 0)
            {
                processTracker.Add("Backing up snapshot", snapshotName);

                await this.BackupFileStorageSnapshot(hostId, sourceDir, targetDir, targetFileSystemType, processTracker);
            }
            else
            {
                processTracker.Add("Backing up snapshot", snapshotName, "with predecessor", prevSnapshotName);

                const prevSourceDir = path.join(this.fileStoragesManager.GetSnapshotsPath(storagePath, fileStorage.fullInstanceName), prevSnapshotName);

                await this.BackupFileStorageSnapshot(hostId, sourceDir, targetDir, targetFileSystemType, processTracker, prevSourceDir);
            }

            processTracker.Add("Finished copying snapshot", snapshotName);
        }
    }

    private async BackupFileStorageSnapshot(hostId: number, sourceDir: string, targetDir: string, targetFileSystemType: TargetFileSystemType, processTracker: ProcessTracker, prevSourceDir?: string)
    {
        switch(targetFileSystemType)
        {
            case "btrfs":
            {
                const cmdExtra = [];

                processTracker.Add("Doing btrfs send/receive backup");

                if(prevSourceDir !== undefined)
                    cmdExtra.push("-p", prevSourceDir);

                await this.remoteCommandExecutor.ExecuteCommand({
                    type: "pipe",
                    sudo: true,
                    source: ["btrfs", "send", ...cmdExtra, sourceDir],
                    target: ["btrfs", "receive", targetDir]
                }, hostId);
            }
            break;
            case "limited":
            {
                processTracker.Add("Doing tar/gz backup");

                const snapshotName = this.ReplaceSpecialCharacters(path.basename(sourceDir), targetFileSystemType);
                const targetPath = path.join(targetDir, snapshotName + ".tar.gz");

                await this.remoteCommandExecutor.ExecuteCommand({
                    type: "redirect-stdout",
                    source: {
                        type: "pipe",
                        source: ["tar", "-cf", "-", "-C", sourceDir, "."],
                        target: ["gzip"]
                    },
                    target: [targetPath],
                    sudo: true
                }, hostId);
            }
            break;
            case "linux":
            {
                processTracker.Add("Doing rsync backup");
                processTracker.Add("THIS HAS NOT BEED TESTED");
                throw new Error("TEST THIS");
                const cmd = ["sudo", "rsync", "--archive", "--quiet", sourceDir, targetDir];
                await this.remoteCommandExecutor.ExecuteCommand(cmd, hostId);
            }
            break;
        }
    }

    private DoesTargetSnapshotExist(snapshotName: string, targetSnapshots: Set<string>, targetFileSystemType: TargetFileSystemType)
    {
        switch(targetFileSystemType)
        {
            case "btrfs":
            case "linux":
                return targetSnapshots.has(snapshotName);
            case "limited":
                return targetSnapshots.has(this.ReplaceSpecialCharacters(snapshotName, targetFileSystemType) + ".tar.gz");
        }
    }

    private ReplaceSpecialCharacters(input: string, targetFileSystemType: TargetFileSystemType)
    {
        if(targetFileSystemType === "limited")
            return input.replace(/[:]/g, "_");
        return input;
    }
}