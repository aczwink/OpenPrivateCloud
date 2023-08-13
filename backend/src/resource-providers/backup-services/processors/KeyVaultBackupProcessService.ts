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
import { BackupVaultRetentionConfig, KeyVaultBackupConfig } from "../models";
import { ResourcesManager } from "../../../services/ResourcesManager";
import { BuildBackupPath, CreateGPGEncryptionCommandOrPipe, CreateSnapshotFileName, DeleteSingleFileSnapshotsThatAreOlderThanRetentionPeriod } from "./Shared";
import { RemoteRootFileSystemManager } from "../../../services/RemoteRootFileSystemManager";
import { TargetFileSystemType } from "../BackupTargetMountService";
import { RemoteCommandExecutor } from "../../../services/RemoteCommandExecutor";
import { ProcessTracker } from "../../../services/ProcessTrackerManager";

@Injectable
export class KeyVaultBackupProcessService
{
    constructor(private resourcesManager: ResourcesManager, private remoteRootFileSystemManager: RemoteRootFileSystemManager, private remoteCommandExecutor: RemoteCommandExecutor)
    {
    }

    //Public methods
    public async Backup(hostId: number, keyVault: KeyVaultBackupConfig, backupTargetPath: string, targetFileSystemType: TargetFileSystemType, encryptionKeyKeyVaultReference: string | undefined, processTracker: ProcessTracker)
    {
        const sourceRef = await this.resourcesManager.CreateResourceReference(keyVault.resourceId);

        const targetResourcePath = BuildBackupPath(backupTargetPath, sourceRef!.id);
        await this.remoteRootFileSystemManager.CreateDirectory(hostId, targetResourcePath);

        const targetSnapshotFileName = CreateSnapshotFileName(".zip", encryptionKeyKeyVaultReference, targetFileSystemType);
        const targetSnapshotFilePath = path.join(targetResourcePath, targetSnapshotFileName);

        processTracker.Add("Backing up Key Vault", sourceRef!.externalId);

        const sourceDir = this.resourcesManager.BuildResourceStoragePath(sourceRef!);
        await this.remoteCommandExecutor.ExecuteCommand({
            type: "redirect-stdout",
            source: await CreateGPGEncryptionCommandOrPipe(["tar", "-cf", "-", "-C", sourceDir, "."], encryptionKeyKeyVaultReference),
            target: [targetSnapshotFilePath],
            sudo: true
        }, hostId);
    }

    public async DeleteSnapshotsThatAreOlderThanRetentionPeriod(hostId: number, backupTargetPath: string, retention: BackupVaultRetentionConfig, keyVault: KeyVaultBackupConfig, processTracker: ProcessTracker)
    {
        const targetResourcePath = BuildBackupPath(backupTargetPath, keyVault.resourceId);

        await DeleteSingleFileSnapshotsThatAreOlderThanRetentionPeriod(hostId, targetResourcePath, "database", retention, processTracker);
    }
}