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
import fs from "fs";
import path from "path";
import { Injectable } from "acts-util-node";
import { ProcessTracker } from "../../../services/ProcessTrackerManager";
import { BackupVaultRetentionConfig } from "../models";
import { RemoteRootFileSystemManager } from "../../../services/RemoteRootFileSystemManager";
import { CreateGPGEncryptionCommandOrPipe, DeleteSingleFileSnapshotsThatAreOlderThanRetentionPeriod, ParseReplacedName, ReplaceSpecialCharacters } from "./Shared";
import { TempFilesManager } from "../../../services/TempFilesManager";
import { TargetFileSystemType } from "../BackupTargetMountService";
import { LocalCommandExecutor } from "../../../services/LocalCommandExecutor";
import { RemoteCommandExecutor } from "../../../services/RemoteCommandExecutor";

@Injectable
export class ControllerDatabaseBackupService
{
    constructor(private remoteRootFileSystemManager: RemoteRootFileSystemManager, private tempFilesManager: TempFilesManager, private localCommandExecutor: LocalCommandExecutor, 
        private remoteCommandExecutor: RemoteCommandExecutor)
    {
    }

    //Public methods
    public async Backup(hostId: number, backupTargetPath: string, targetFileSystemType: TargetFileSystemType, encryptionKeyKeyVaultReference: string | undefined, processTracker: ProcessTracker)
    {
        const targetResourcePath = path.join(backupTargetPath, "opc-controller-database");
        await this.remoteRootFileSystemManager.CreateDirectory(hostId, targetResourcePath);

        const snapshotFileName = new Date().toISOString() + ".sql.gz" + (encryptionKeyKeyVaultReference === undefined ? "" : ".gpg");
        const targetSnapshotFileName = ReplaceSpecialCharacters(snapshotFileName, targetFileSystemType);
        const targetPath = path.join(targetResourcePath, targetSnapshotFileName);

        processTracker.Add("Backing up Controller database");

        await this.DoDatabaseExportAndStoreFile(hostId, encryptionKeyKeyVaultReference, targetPath);
    }

    public async DeleteSnapshotsThatAreOlderThanRetentionPeriod(hostId: number, backupTargetPath: string, retention: BackupVaultRetentionConfig, processTracker: ProcessTracker)
    {
        const targetResourcePath = path.join(backupTargetPath, "opc-controller-database");
        await DeleteSingleFileSnapshotsThatAreOlderThanRetentionPeriod(hostId, targetResourcePath, "controller database", retention, processTracker);
    }

    //Private methods
    private async DoDatabaseExportAndStoreFile(hostId: number, encryptionKeyKeyVaultReference: string | undefined, targetPath: string)
    {
        const configPath = "/etc/OpenPrivateCloud/config.json";
        const data = await fs.promises.readFile(configPath, "utf-8");
        const config = JSON.parse(data);

        const result = await this.localCommandExecutor.ExecuteCommandWithoutEncoding(['MYSQL_PWD="' + config.database.password + '"', "mysqldump", "-u", config.database.userName, "openprivatecloud", "|", "gzip"]);
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