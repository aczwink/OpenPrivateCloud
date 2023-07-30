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
import { HostUsersManager } from "./HostUsersManager";
import { RemoteFileSystemManager } from "./RemoteFileSystemManager";
import { RemoteCommandExecutor } from "./RemoteCommandExecutor";
import { opcSpecialUsers } from "../common/UserAndGroupDefinitions";

 
@Injectable
export class RemoteRootFileSystemManager
{
    constructor(private remoteFileSystemManager: RemoteFileSystemManager, private hostUsersManager: HostUsersManager, private remoteCommandExecutor: RemoteCommandExecutor)
    {
    }

    //Public methods
    public async ChangeMode(hostId: number, remotePath: string, mode: number)
    {
        await this.remoteCommandExecutor.ExecuteCommand(["sudo", "chmod", mode.toString(8), remotePath], hostId);
    }

    public async ChangeOwnerAndGroup(hostId: number, remotePath: string, uid: number, gid: number)
    {
        await this.remoteCommandExecutor.ExecuteCommand(["sudo", "chown", uid + ":" + gid, remotePath], hostId);
    }

    public async CreateDirectory(hostId: number, remotePath: string)
    {
        const exitCode = await this.remoteCommandExecutor.ExecuteCommandWithExitCode(["sudo", "mkdir", remotePath], hostId);
        return exitCode === 0;
    }

    public async CreateSymbolicLink(hostId: number, remotePath: string, linkTargetPath: string)
    {
        await this.remoteCommandExecutor.ExecuteCommand(["sudo", "ln", "-s", linkTargetPath, remotePath], hostId)
    }

    public async ListDirectoryContents(hostId: number, remotePath: string)
    {
        const pythonCode = "import os, json; print(json.dumps(os.listdir('" + remotePath + "')))";
        const result = await this.remoteCommandExecutor.ExecuteBufferedCommand(["sudo", "python3", "-c", pythonCode], hostId);
        return JSON.parse(result.stdOut.trim()) as string[];
    }

    public async MoveFile(hostId: number, sourcePath: string, targetPath: string)
    {
        await this.remoteCommandExecutor.ExecuteCommand(["sudo", "mv", sourcePath, targetPath], hostId);
    }

    public async ReadTextFile(hostId: number, filePath: string)
    {
        const result = await this.remoteCommandExecutor.ExecuteBufferedCommand(["sudo", "cat", filePath], hostId);
        return result.stdOut;
    }

    public async RemoveDirectory(hostId: number, remotePath: string)
    {
        await this.remoteCommandExecutor.ExecuteCommand(["sudo", "rmdir", remotePath], hostId);
    }

    public async RemoveDirectoryRecursive(hostId: number, remotePath: string)
    {
        await this.remoteCommandExecutor.ExecuteCommand(["sudo", "rm", "-rf", remotePath], hostId);
    }

    public async RemoveFile(hostId: number, remotePath: string)
    {
        await this.remoteCommandExecutor.ExecuteCommand(["sudo", "rm", remotePath], hostId);
    }

    public async WriteTextFile(hostId: number, filePath: string, text: string)
    {
        let status = undefined;
        try
        {
            status = await this.remoteFileSystemManager.QueryStatus(hostId, filePath);
        }
        catch(_)
        {
        }

        const tempPath = await this.RequestTempPath(hostId);
        await this.remoteFileSystemManager.WriteTextFile(hostId, tempPath, text);
        await this.remoteCommandExecutor.ExecuteCommand(["sudo", "mv", "-f", tempPath, filePath], hostId);

        if(status !== undefined)
        {
            await this.remoteFileSystemManager.ChangeMode(hostId, filePath, status.mode);
            await this.ChangeOwnerAndGroup(hostId, filePath, status.uid, status.gid);
        }
    }

    //Private methods
    private async RequestTempPath(hostId: number)
    {
        const tempRootPath = "/tmp/opc";
        const hostOPCUserId = await this.hostUsersManager.ResolveHostUserId(hostId, opcSpecialUsers.host);
        await this.remoteFileSystemManager.CreateDirectory(hostId, tempRootPath, {
            uid: hostOPCUserId
        });

        return path.join(tempRootPath, crypto.pseudoRandomBytes(16).toString("hex"));
    }
}