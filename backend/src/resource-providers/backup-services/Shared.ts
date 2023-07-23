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
import { Command } from "../../services/SSHService";
import { TargetFileSystemType } from "./BackupTargetMountService";

export function BuildBackupPath(backupTargetPath: string, resourceId: number)
{
    return path.join(backupTargetPath, "opc-bkpvltcnt-" + resourceId);
}

export function CreateGPGEncryptionCommandOrPipe(input: Command, secretPath: string | undefined): Command
{
    if(secretPath === undefined)
        return input;

    return {
        type: "pipe",
        source: input,
        target: [
            "gpg",
            "-z", "0", //no compression
            "--passphrase-file", secretPath,
            "--cipher-algo", "AES256",
            "--symmetric",
            "--batch",
            "--no-symkey-cache", //don't cache password in keyring
            "-" //write to stdout
        ]
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