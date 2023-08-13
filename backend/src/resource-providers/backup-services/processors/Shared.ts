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
import { Command } from "../../../services/SSHService";
import { TargetFileSystemType } from "../BackupTargetMountService";
import { GlobalInjector } from "acts-util-node";
import { KeyVaultManager } from "../../security-services/KeyVaultManager";
import { RemoteRootFileSystemManager } from "../../../services/RemoteRootFileSystemManager";
import { ProcessTracker } from "../../../services/ProcessTrackerManager";
import { BackupVaultRetentionConfig } from "../models";

export function BuildBackupPath(backupTargetPath: string, resourceId: number)
{
    return path.join(backupTargetPath, "opc-bkpvltcnt-" + resourceId);
}

export async function CreateGPGEncryptionCommandOrPipe(input: Command, encryptionKeyKeyVaultReference: string | undefined): Promise<Command>
{
    if(encryptionKeyKeyVaultReference === undefined)
        return input;

    return await GlobalInjector.Resolve(KeyVaultManager).CreateEncryptionCommand(input, encryptionKeyKeyVaultReference);
}

export function CreateSnapshotFileName(unencryptedExtension: string, encryptionKeyKeyVaultReference: string | undefined, targetFileSystemType: TargetFileSystemType)
{
    const snapshotFileName = new Date().toISOString() + (encryptionKeyKeyVaultReference === undefined ? unencryptedExtension : ".gpg");
    const targetSnapshotFileName = ReplaceSpecialCharacters(snapshotFileName, targetFileSystemType);
    return targetSnapshotFileName;
}

export async function DeleteSingleFileSnapshotsThatAreOlderThanRetentionPeriod(hostId: number, targetPath: string, resourceType: string, retention: BackupVaultRetentionConfig, processTracker: ProcessTracker)
{
    const remoteRootFileSystemManager = GlobalInjector.Resolve(RemoteRootFileSystemManager);

    const msToDay = 1000 * 60 * 60 * 24;
    const currentDay = Date.now() / msToDay;

    const backupFileNames = await remoteRootFileSystemManager.ListDirectoryContents(hostId, targetPath);
    for (const backupFileName of backupFileNames)
    {
        const pos = backupFileName.indexOf("Z") + 1;
        const name = backupFileName.substring(0, pos);
        
        const backupName = ParseReplacedName(name);
        const backupDate = new Date(backupName);

        const backupDay = backupDate.valueOf() / msToDay;
        if((backupDay + retention.numberOfDays) < currentDay)
        {
            processTracker.Add("Deleting old " + resourceType + " backup", backupName);
            await remoteRootFileSystemManager.RemoveFile(hostId, path.join(targetPath, backupFileName));
        }
    }
}

export function ReplaceSpecialCharacters(input: string, targetFileSystemType: TargetFileSystemType)
{
    if(targetFileSystemType === "limited")
        return input.replace(/[:]/g, "_");
    return input;
}

export function ParseReplacedName(input: string)
{
    return input.replace(/[_]/g, ":");
}