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
import crypto from "crypto";
import path from "path";
import { Injectable } from "acts-util-node";
import { HostUsersManager } from "./HostUsersManager";
import { RemoteFileSystemManager } from "./RemoteFileSystemManager";
import { RemoteCommandExecutor } from "./RemoteCommandExecutor";

 
@Injectable
export class RemoteRootFileSystemManager
{
    constructor(private remoteFileSystemManager: RemoteFileSystemManager, private hostUsersManager: HostUsersManager, private remoteCommandExecutor: RemoteCommandExecutor)
    {
    }

    //Public methods
    public async ChangeOwnerAndGroup(hostId: number, remotePath: string, uid: number, gid: number)
    {
        await this.remoteCommandExecutor.ExecuteCommand(["sudo", "chown", uid + ":" + gid, remotePath], hostId);
    }

    public async RemoveDirectoryRecursive(hostId: number, remotePath: string)
    {
        await this.remoteCommandExecutor.ExecuteCommand(["sudo", "rm", "-rf", remotePath], hostId);
    }

    public async WriteTextFile(hostId: number, filePath: string, text: string)
    {
        const status = await this.remoteFileSystemManager.QueryStatus(hostId, filePath);

        const tempPath = await this.RequestTempPath(hostId);
        await this.remoteFileSystemManager.WriteTextFile(hostId, tempPath, text);
        await this.remoteCommandExecutor.ExecuteCommand(["sudo", "mv", "-f", tempPath, filePath], hostId);

        await this.remoteFileSystemManager.ChangeMode(hostId, filePath, status.mode);
        await this.ChangeOwnerAndGroup(hostId, filePath, status.uid, status.gid);
    }

    //Private methods
    private async RequestTempPath(hostId: number)
    {
        const tempRootPath = "/tmp/opc";
        const hostOPCUserId = await this.hostUsersManager.ResolveHostUserId(hostId, "opc");
        await this.remoteFileSystemManager.CreateDirectory(hostId, tempRootPath, {
            uid: hostOPCUserId
        });

        return path.join(tempRootPath, crypto.pseudoRandomBytes(16).toString("hex"));
    }
}