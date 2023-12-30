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
import { RemoteFileSystemManager } from "./RemoteFileSystemManager";
import { RemoteRootFileSystemManager } from "./RemoteRootFileSystemManager";

@Injectable
export class TempFilesManager
{
    constructor(private remoteFileSystemManager: RemoteFileSystemManager, private remoteRootFileSystemManager: RemoteRootFileSystemManager)
    {
    }

    //Public methods
    public async Cleanup(hostId: number, tempPath: string)
    {
        await this.remoteRootFileSystemManager.RemoveDirectoryRecursive(hostId, tempPath);
    }

    public async CreateFile(hostId: number, data: Buffer)
    {
        const tempPath = await this.CreateUniqueTempPath(hostId);
        await this.remoteFileSystemManager.WriteFile(hostId, tempPath, data);
        return tempPath;
    }

    public async CreateSecretFile(hostId: number, secret: Buffer): Promise<string>
    {
        const secretPath = await this.CreateUniqueTempPath(hostId);
        await this.remoteFileSystemManager.WriteFile(hostId, secretPath, secret);
        await this.remoteFileSystemManager.ChangeMode(hostId, secretPath, 0o600);

        return secretPath;
    }

    public async CreateStringSecretFile(hostId: number, secret: string): Promise<string>
    {
        const secretPath = await this.CreateUniqueTempPath(hostId);
        await this.remoteFileSystemManager.WriteTextFile(hostId, secretPath, secret, 0o600);

        return secretPath;
    }

    //Private methods
    private async CreateUniqueTempPath(hostId: number)
    {
        const tempRootPath = "/tmp/opc";
        await this.remoteFileSystemManager.CreateDirectory(hostId, tempRootPath);

        return path.join(tempRootPath, crypto.pseudoRandomBytes(16).toString("hex"));
    }
}