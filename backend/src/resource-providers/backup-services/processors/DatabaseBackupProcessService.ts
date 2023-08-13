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
import { ProcessTracker } from "../../../services/ProcessTrackerManager";
import { TargetFileSystemType } from "../BackupTargetMountService";
import { CreateGPGEncryptionCommandOrPipe, ParseReplacedName, BuildBackupPath, CreateSnapshotFileName, DeleteSingleFileSnapshotsThatAreOlderThanRetentionPeriod } from "./Shared";
import { BackupVaultDatabaseConfig, BackupVaultRetentionConfig } from "../models";
import { ResourcesManager } from "../../../services/ResourcesManager";
import { RemoteRootFileSystemManager } from "../../../services/RemoteRootFileSystemManager";
import { RemoteCommandExecutor } from "../../../services/RemoteCommandExecutor";

@Injectable
export class DatabaseBackupProcessService
{
    constructor(private resourcesManager: ResourcesManager, private remoteRootFileSystemManager: RemoteRootFileSystemManager, private remoteCommandExecutor: RemoteCommandExecutor)
    {
    }
    
    //Public methods
    public async BackupDatabase(hostId: number, database: BackupVaultDatabaseConfig, backupTargetPath: string, targetFileSystemType: TargetFileSystemType, encryptionKeyKeyVaultReference: string | undefined, processTracker: ProcessTracker)
    {
        const sourceRef = await this.resourcesManager.CreateResourceReferenceFromExternalId(database.externalId);
        if(sourceRef === undefined)
        {
            processTracker.Add("ERROR! Database not found:", database.externalId, database.databaseName);
            return;
        }

        const targetResourcePath = BuildBackupPath(backupTargetPath, sourceRef.id);
        await this.remoteRootFileSystemManager.CreateDirectory(hostId, targetResourcePath);

        const dbFolderName = this.DeriveDbFolderName(database.databaseName, encryptionKeyKeyVaultReference);
        const targetPath = path.join(targetResourcePath, dbFolderName);
        await this.remoteRootFileSystemManager.CreateDirectory(hostId, targetPath);

        const targetSnapshotFileName = CreateSnapshotFileName(".sql.gz", encryptionKeyKeyVaultReference, targetFileSystemType);

        processTracker.Add("Backing up MariaDB database", database.databaseName);

        const dumpPath = path.join(targetPath, targetSnapshotFileName);
        await this.remoteCommandExecutor.ExecuteCommand({
            source: await CreateGPGEncryptionCommandOrPipe({
                source: ["mysqldump", "-u", "root", database.databaseName],
                target: ["gzip"],
                type: "pipe",
            }, encryptionKeyKeyVaultReference),
            target: [dumpPath],
            type: "redirect-stdout",
            sudo: true
        }, hostId);
    }

    public async DeleteSnapshotsThatAreOlderThanRetentionPeriod(hostId: number, database: BackupVaultDatabaseConfig, backupTargetPath: string, targetFileSystemType: TargetFileSystemType, retention: BackupVaultRetentionConfig, encryptionKeyKeyVaultReference: string | undefined, processTracker: ProcessTracker)
    {
        const sourceRef = await this.resourcesManager.CreateResourceReferenceFromExternalId(database.externalId);
        if(sourceRef === undefined)
        {
            processTracker.Add("ERROR! Database not found:", database.externalId, database.databaseName);
            return;
        }

        const targetResourcePath = BuildBackupPath(backupTargetPath, sourceRef.id);

        const dbFolderName = this.DeriveDbFolderName(database.databaseName, encryptionKeyKeyVaultReference);
        const targetPath = path.join(targetResourcePath, dbFolderName);

        await DeleteSingleFileSnapshotsThatAreOlderThanRetentionPeriod(hostId, targetPath, "database", retention, processTracker);
    }

    //Private methods
    private DeriveDbFolderName(databaseName: string, encryptionKeyKeyVaultReference: string | undefined)
    {
        return (encryptionKeyKeyVaultReference === undefined) ? databaseName : this.HashDbName(databaseName, encryptionKeyKeyVaultReference)
    };

    private HashDbName(databaseName: string, salt: string)
    {
        return crypto.createHash("sha256").update(salt).update(databaseName).digest('hex');
    }
}