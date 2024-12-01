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
import path from "path";
import { Injectable } from "acts-util-node";
import { ProcessTracker } from "../../../services/ProcessTrackerManager";
import { BackupVaultRetentionConfig } from "../models";
import { RemoteRootFileSystemManager } from "../../../services/RemoteRootFileSystemManager";
import { CreateGPGEncryptionCommandOrPipe, DeleteSingleFileSnapshotsThatAreOlderThanRetentionPeriod, ReplaceSpecialCharacters } from "./Shared";
import { TempFilesManager } from "../../../services/TempFilesManager";
import { TargetFileSystemType } from "../BackupTargetMountService";
import { LocalCommandExecutor } from "../../../services/LocalCommandExecutor";
import { RemoteCommandExecutor } from "../../../services/RemoteCommandExecutor";
import { DBConnectionsManager } from "../../../data-access/DBConnectionsManager";

@Injectable
export class ControllerDatabaseServerBackupService
{
    constructor(private remoteRootFileSystemManager: RemoteRootFileSystemManager, private tempFilesManager: TempFilesManager, private localCommandExecutor: LocalCommandExecutor, 
        private remoteCommandExecutor: RemoteCommandExecutor, private dbConnectionsManager: DBConnectionsManager)
    {
    }

    //Public methods
    public async BackupDatabase(hostId: number, backupTargetPath: string, targetFileSystemType: TargetFileSystemType, encryptionKeyKeyVaultReference: string | undefined, processTracker: ProcessTracker, shortName: "opc" | "oidp")
    {
        const targetResourcePath = path.join(backupTargetPath, shortName + "-controller-database");
        await this.remoteRootFileSystemManager.CreateDirectory(hostId, targetResourcePath);

        const snapshotFileName = new Date().toISOString() + ".sql.gz" + (encryptionKeyKeyVaultReference === undefined ? "" : ".gpg");
        const targetSnapshotFileName = ReplaceSpecialCharacters(snapshotFileName, targetFileSystemType);
        const targetPath = path.join(targetResourcePath, targetSnapshotFileName);

        processTracker.Add("Backing up database from controller database server: " + shortName);

        await this.DoDatabaseExportAndStoreFile(hostId, encryptionKeyKeyVaultReference, targetPath, shortName);
    }

    public async DeleteSnapshotsThatAreOlderThanRetentionPeriod(hostId: number, backupTargetPath: string, retention: BackupVaultRetentionConfig, processTracker: ProcessTracker, shortName: "opc" | "oidp")
    {
        const targetResourcePath = path.join(backupTargetPath, shortName + "-controller-database");
        await DeleteSingleFileSnapshotsThatAreOlderThanRetentionPeriod(hostId, targetResourcePath, shortName + " controller database", retention, processTracker);
    }

    //Private methods
    private async DoDatabaseExportAndStoreFile(hostId: number, encryptionKeyKeyVaultReference: string | undefined, targetPath: string, shortName: "opc" | "oidp")
    {
        const info = await this.dbConnectionsManager.CollectConnectionInfo();

        const dbName = (shortName === "oidp") ? "openidentityprovider" : info.dbName;
        const result = await this.localCommandExecutor.ExecuteCommandWithoutEncoding(['MYSQL_PWD="' + info.password + '"', "mysqldump", "-u", info.user, "-h", info.host, dbName, "|", "gzip"]);
        const tempDumpPath = await this.tempFilesManager.CreateFile(hostId, result);

        try
        {
            await this.StoreTargetFile(hostId, encryptionKeyKeyVaultReference, tempDumpPath, targetPath);
        }
        finally
        {
            await this.tempFilesManager.Cleanup(hostId, tempDumpPath);
        }
    }

    private async StoreTargetFile(hostId: number, encryptionKeyKeyVaultReference: string | undefined, sourcePath: string, targetPath: string)
    {
        if(encryptionKeyKeyVaultReference === undefined)
        {
            await this.remoteRootFileSystemManager.MoveFile(hostId, sourcePath, targetPath);
        }
        else
        {
            await this.remoteCommandExecutor.ExecuteCommand({
                source: await CreateGPGEncryptionCommandOrPipe(["cat", sourcePath], encryptionKeyKeyVaultReference),
                target: [targetPath],
                type: "redirect-stdout",
                sudo: true
            }, hostId);
        }
    }
}