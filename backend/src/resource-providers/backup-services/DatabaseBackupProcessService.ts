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
import crypto from "crypto";
import path from "path";
import { Injectable } from "acts-util-node";
import { ProcessTracker } from "../../services/ProcessTrackerManager";
import { TargetFileSystemType } from "./BackupTargetMountService";
import { ReplaceSpecialCharacters, CreateGPGEncryptionCommandOrPipe, ParseReplacedName } from "./Shared";
import { BackupVaultDatabaseConfig, BackupVaultRetentionConfig } from "./models";
import { ResourcesManager } from "../../services/ResourcesManager";
import { RemoteRootFileSystemManager } from "../../services/RemoteRootFileSystemManager";
import { TempFilesManager } from "../../services/TempFilesManager";
import { RemoteCommandExecutor } from "../../services/RemoteCommandExecutor";

@Injectable
export class DatabaseBackupProcessService
{
    constructor(private instancesManager: ResourcesManager, private remoteRootFileSystemManager: RemoteRootFileSystemManager,
        private tempFilesManager: TempFilesManager, private remoteCommandExecutor: RemoteCommandExecutor)
    {
    }
    
    //Public methods
    public async BackupDatabase(hostId: number, database: BackupVaultDatabaseConfig, backupTargetPath: string, targetFileSystemType: TargetFileSystemType, encryptionPassphrase: string | undefined, processTracker: ProcessTracker)
    {
        const targetInstancePath = this.instancesManager.BuildInstanceStoragePath(backupTargetPath, database.fullInstanceName);
        await this.remoteRootFileSystemManager.CreateDirectory(hostId, targetInstancePath);

        const dbFolderName = this.DeriveDbFolderName(database.databaseName, encryptionPassphrase);
        const targetPath = path.join(targetInstancePath, dbFolderName);
        await this.remoteRootFileSystemManager.CreateDirectory(hostId, targetPath);

        const snapshotFileName = new Date().toISOString() + ".sql.gz" + (encryptionPassphrase === undefined ? "" : ".gpg");
        const targetSnapshotFileName = ReplaceSpecialCharacters(snapshotFileName, targetFileSystemType);

        processTracker.Add("Backing up MariaDB database", database.databaseName);

        let secretPath = undefined;
        if(encryptionPassphrase !== undefined)
            secretPath = await this.tempFilesManager.CreateSecretFile(hostId, encryptionPassphrase);

        const dumpPath = path.join(targetPath, targetSnapshotFileName);
        await this.remoteCommandExecutor.ExecuteCommand({
            source: CreateGPGEncryptionCommandOrPipe({
                source: ["mysqldump", "-u", "root", database.databaseName],
                target: ["gzip"],
                type: "pipe",
            }, secretPath),
            target: [dumpPath],
            type: "redirect-stdout",
            sudo: true
        }, hostId);

        if(secretPath !== undefined)
            await this.tempFilesManager.Cleanup(hostId, secretPath);
    }

    public async DeleteSnapshotsThatAreOlderThanRetentionPeriod(hostId: number, database: BackupVaultDatabaseConfig, backupTargetPath: string, targetFileSystemType: TargetFileSystemType, retention: BackupVaultRetentionConfig, encryptionPassphrase: string | undefined, processTracker: ProcessTracker)
    {
        const targetInstancePath = this.instancesManager.BuildInstanceStoragePath(backupTargetPath, database.fullInstanceName);
        const dbFolderName = this.DeriveDbFolderName(database.databaseName, encryptionPassphrase);
        const targetPath = path.join(targetInstancePath, dbFolderName);

        const msToDay = 1000 * 60 * 60 * 24;
        const currentDay = Date.now() / msToDay;

        const backupFileNames = await this.remoteRootFileSystemManager.ListDirectoryContents(hostId, targetPath);
        for (const backupFileName of backupFileNames)
        {
            const parts = backupFileName.split(".sql");
            const backupName = ParseReplacedName(parts[0]);
            const backupDate = new Date(backupName);

            const backupDay = backupDate.valueOf() / msToDay;
            if((backupDay + retention.numberOfDays) < currentDay)
            {
                processTracker.Add("Deleting old database backup", backupName);
                await this.remoteRootFileSystemManager.RemoveFile(hostId, path.join(targetPath, backupFileName));
            }
        }
    }

    //Private methods
    private DeriveDbFolderName(databaseName: string, encryptionPassphrase: string | undefined)
    {
        return (encryptionPassphrase === undefined) ? databaseName : this.HashDbName(databaseName, encryptionPassphrase)
    };

    private HashDbName(databaseName: string, salt: string)
    {
        return crypto.createHash("sha256").update(salt).update(databaseName).digest('hex');
    }
}