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
import path from "path";
import { ProcessTracker } from "../../services/ProcessTrackerManager";
import { TargetFileSystemType } from "./BackupTargetMountService";
import { BackupVaultFileStorageConfig, BackupVaultRetentionConfig } from "./models";
import { FileStoragesManager } from "../file-services/FileStoragesManager";
import { ResourcesManager } from "../../services/ResourcesManager";
import { RemoteRootFileSystemManager } from "../../services/RemoteRootFileSystemManager";
import { RemoteCommandExecutor } from "../../services/RemoteCommandExecutor";
import { TempFilesManager } from "../../services/TempFilesManager";
import { BuildBackupPath, CreateGPGEncryptionCommandOrPipe, ParseReplacedName, ReplaceSpecialCharacters } from "./Shared";

@Injectable
export class FileStorageBackupProcessService
{
    constructor(private fileStoragesManager: FileStoragesManager, private resourcesManager: ResourcesManager, private remoteRootFileSystemManager: RemoteRootFileSystemManager, private remoteCommandExecutor: RemoteCommandExecutor,
        private tempFilesManager: TempFilesManager)
    {
    }
    
    //Public methods
    public async BackupFileStorage(hostId: number, fileStorage: BackupVaultFileStorageConfig, backupTargetPath: string, targetFileSystemType: TargetFileSystemType, encryptionPassphrase: string | undefined, processTracker: ProcessTracker)
    {
        const sourceRef = await this.resourcesManager.CreateResourceReferenceFromExternalId(fileStorage.externalId);
        if(sourceRef === undefined)
        {
            processTracker.Add("ERROR! FileStorage not found:", fileStorage.externalId);
            return;
        }

        if(fileStorage.createSnapshotBeforeBackup)
        {
            processTracker.Add("Creating snapshot for FileStorage", fileStorage.externalId);
            await this.fileStoragesManager.CreateSnapshot(sourceRef);
        }

        processTracker.Add("Beginning to backup FileStorage", fileStorage.externalId);

        const sourceSnapshots = (await this.fileStoragesManager.QuerySnapshotsOrdered(sourceRef)).ToArray();

        const targetDir = BuildBackupPath(backupTargetPath, sourceRef.id);
        await this.remoteRootFileSystemManager.CreateDirectory(hostId, targetDir);

        const targetSnapshots = await this.LoadTargetSnapshots(hostId, targetDir);

        const toBeSynced = sourceSnapshots.Values().Filter(x => targetSnapshots.find(y => y.snapshotName === x.snapshotName) === undefined).OrderBy(x => x.snapshotName).ToArray();
        for (const snapshot of toBeSynced)
        {
            const snapshotName = snapshot.snapshotName;
            const idx = sourceSnapshots.indexOf(snapshot);

            const sourceDir = path.join(this.fileStoragesManager.GetSnapshotsPath(sourceRef), snapshotName);

            if(idx === 0)
            {
                processTracker.Add("Backing up snapshot", snapshotName);

                await this.BackupFileStorageSnapshot(hostId, sourceDir, targetDir, targetFileSystemType, encryptionPassphrase, processTracker);
            }
            else
            {
                const prevSnapshotName = sourceSnapshots[idx - 1].snapshotName;
                processTracker.Add("Backing up snapshot", snapshotName, "with predecessor", prevSnapshotName);

                const prevSourceDir = path.join(this.fileStoragesManager.GetSnapshotsPath(sourceRef), prevSnapshotName);

                await this.BackupFileStorageSnapshot(hostId, sourceDir, targetDir, targetFileSystemType, encryptionPassphrase, processTracker, prevSourceDir);
            }

            processTracker.Add("Finished copying snapshot", snapshotName);
        }
    }

    public async DeleteSnapshotsThatAreOlderThanRetentionPeriod(hostId: number, fileStorage: BackupVaultFileStorageConfig, backupTargetPath: string, targetFileSystemType: TargetFileSystemType, retention: BackupVaultRetentionConfig, processTracker: ProcessTracker)
    {
        const sourceRef = await this.resourcesManager.CreateResourceReferenceFromExternalId(fileStorage.externalId);
        if(sourceRef === undefined)
        {
            processTracker.Add("ERROR! FileStorage not found:", fileStorage.externalId);
            return;
        }

        const targetDir = BuildBackupPath(backupTargetPath, sourceRef.id);
        const targetSnapshots = await this.LoadTargetSnapshots(hostId, targetDir);

        const msToDay = 1000 * 60 * 60 * 24;
        const currentDay = Date.now() / msToDay;

        for (const targetSnapshot of targetSnapshots)
        {
            const snapshotDay = targetSnapshot.creationDate.valueOf() / msToDay;
            if((snapshotDay + retention.numberOfDays) < currentDay)
            {
                processTracker.Add("Deleting old snapshot", targetSnapshot.snapshotName);
                await this.DeleteSnapshot(hostId, targetFileSystemType, targetDir, targetSnapshot.fileName);
            }
        }
    }
    private async DeleteSnapshot(hostId: number, targetFileSystemType: TargetFileSystemType, targetDir: string, snapshotFileName: string)
    {
        switch(targetFileSystemType)
        {
            case "limited":
                await this.remoteRootFileSystemManager.RemoveFile(hostId, path.join(targetDir, snapshotFileName));
                break;
            default:
                throw new Error("Method not implemented.");
        }
    }

    //Private methods
    private async BackupFileStorageSnapshot(hostId: number, sourceDir: string, targetDir: string, targetFileSystemType: TargetFileSystemType, encryptionPassphrase: string | undefined, processTracker: ProcessTracker, prevSourceDir?: string)
    {
        switch(targetFileSystemType)
        {
            case "btrfs":
            {
                if(encryptionPassphrase !== undefined)
                    throw new Error("should never happen");

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

                const snapshotName = ReplaceSpecialCharacters(path.basename(sourceDir), targetFileSystemType);
                const targetPath = path.join(targetDir, snapshotName + ".tar.gz" + (encryptionPassphrase === undefined ? "" : ".gpg"));

                let secretPath = undefined;
                if(encryptionPassphrase !== undefined)
                    secretPath = await this.tempFilesManager.CreateSecretFile(hostId, encryptionPassphrase);

                await this.remoteCommandExecutor.ExecuteCommand({
                    type: "redirect-stdout",
                    source: CreateGPGEncryptionCommandOrPipe({
                        type: "pipe",
                        source: ["tar", "-cf", "-", "-C", sourceDir, "."],
                        target: ["gzip"]
                    }, secretPath),
                    target: [targetPath],
                    sudo: true
                }, hostId);

                if(secretPath !== undefined)
                    await this.tempFilesManager.Cleanup(hostId, secretPath);
            }
            break;
            case "linux":
            {
                if(encryptionPassphrase !== undefined)
                    throw new Error("should never happen");

                processTracker.Add("Doing rsync backup");
                processTracker.Add("THIS HAS NOT BEED TESTED");
                throw new Error("TEST THIS");
                const cmd = ["sudo", "rsync", "--archive", "--quiet", sourceDir, targetDir];
                await this.remoteCommandExecutor.ExecuteCommand(cmd, hostId);
            }
            break;
        }
    }

    private async LoadTargetSnapshots(hostId: number, targetDir: string)
    {
        function SplitExtensionAway(fileName: string)
        {
            if(fileName.includes(".tar.gz"))
            {
                const parts = fileName.split(".tar.gz");
                return ParseReplacedName(parts[0]);
            }
            return ParseReplacedName(fileName);
        }

        const targetSnapshots = (await this.remoteRootFileSystemManager.ListDirectoryContents(hostId, targetDir));
        return targetSnapshots.map(x => {
            const snapshotName = SplitExtensionAway(x);
            return {
                snapshotName,
                creationDate: new Date(snapshotName),
                fileName: x,
            };
        });
    }
}