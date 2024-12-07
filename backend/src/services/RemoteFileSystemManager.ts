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
import ssh2 from "ssh2";
import { Injectable } from "acts-util-node";
import { RemoteConnectionsManager } from "./RemoteConnectionsManager";
import { Readable } from "stream";

@Injectable
export class RemoteFileSystemManager
{
    constructor(private remoteConnectionsManager: RemoteConnectionsManager)
    {
    }

    //Public methods
    public async ChangeMode(hostId: number, path: string, mode: number)
    {
        const conn = await this.remoteConnectionsManager.AcquireConnection(hostId);
        await conn.value.ChangeMode(path, mode);
        conn.Release();
    }

    public async ChangeOwnerAndGroup(hostId: number, path: string, uid: number, gid: number)
    {
        const conn = await this.remoteConnectionsManager.AcquireConnection(hostId);
        try
        {
            await conn.value.ChangeOwnerAndGroup(path, uid, gid);
        }
        catch(e)
        {
            throw new Error("Changing owner and group of path " + path + " on host " + hostId + " failed. " + e);
        }
        finally
        {
            conn.Release();
        }
    }

    public async CreateDirectory(hostId: number, dirPath: string, attributes?: ssh2.InputAttributes)
    {
        const conn = await this.remoteConnectionsManager.AcquireConnection(hostId);
        const result = await conn.value.CreateDirectory(dirPath, attributes);
        conn.Release();
        return result;
    }

    public async Exists(hostId: number, remotePath: string)
    {
        try
        {
            await this.QueryStatus(hostId, remotePath);
        }
        catch(_)
        {
            return false;
        }
        return true;
    }

    public async ListDirectoryContents(hostId: number, dirPath: string)
    {
        const conn = await this.remoteConnectionsManager.AcquireConnection(hostId);
        try
        {
            const result = await conn.value.ListDirectoryContents(dirPath);
            return result.map(x => x.filename);
        }
        catch(e)
        {
            throw new Error("Listing contents of path " + dirPath + " on host " + hostId + " failed." + e);
        }
        finally
        {
            conn.Release();
        }
    }

    public async MoveFile(hostId: number, sourcePath: string, targetPath: string)
    {
        const conn = await this.remoteConnectionsManager.AcquireConnection(hostId);
        await conn.value.MoveFile(sourcePath, targetPath);
        conn.Release();
    }

    public async QueryStatus(hostId: number, filePath: string)
    {
        const conn = await this.remoteConnectionsManager.AcquireConnection(hostId);
        try
        {
            const result = await conn.value.QueryStatus(filePath);
            return result;
        }
        finally
        {
            conn.Release();
        }
    }

    public async ReadFile(hostId: number, filePath: string)
    {
        const conn = await this.remoteConnectionsManager.AcquireConnection(hostId);
        try
        {
            const result = await conn.value.ReadFile(filePath);
            return result;
        }
        catch(e)
        {
            throw new Error("Reading file at path " + filePath + " on host " + hostId + " failed." + e);
        }
        finally
        {
            conn.Release();
        }
    }

    public async ReadFileBlock(hostId: number, filePath: string, start: number, end: number)
    {
        const conn = await this.remoteConnectionsManager.AcquireConnection(hostId);
        try
        {
            const result = await conn.value.ReadFileBlock(filePath, start, end);
            return result;
        }
        catch(e)
        {
            throw new Error("Reading file block at path " + filePath + " on host " + hostId + " failed." + e);
        }
        finally
        {
            conn.Release();
        }
    }

    public async ReadLink(hostId: number, filePath: string)
    {
        const conn = await this.remoteConnectionsManager.AcquireConnection(hostId);
        const result = await conn.value.ReadLink(filePath);
        conn.Release();
        return result;
    }

    public async ReadTextFile(hostId: number, filePath: string)
    {
        const buffer = await this.ReadFile(hostId, filePath);
        return buffer.toString("utf-8");
    }

    public async RemoveDirectory(hostId: number, path: string)
    {
        const conn = await this.remoteConnectionsManager.AcquireConnection(hostId);
        await conn.value.RemoveDirectory(path);
        conn.Release();
    }

    public async RemoveDirectoryRecursive(hostId: number, dirPath: string)
    {
        const contents = await this.ListDirectoryContents(hostId, dirPath);
        for (const child of contents)
        {
            const childPath = path.join(dirPath, child);
            const status = await this.QueryStatus(hostId, childPath);

            if(status.isDirectory())
                await this.RemoveDirectoryRecursive(hostId, childPath);
            else
                await this.UnlinkFile(hostId, childPath);
        }

        await this.RemoveDirectory(hostId, dirPath);
    }

    public async Replicate(srcHostId: number, srcPath: string, targetHostId: number, targetPath: string)
    {
        const status = await this.QueryStatus(srcHostId, srcPath);
        if(status.isDirectory())
        {
            await this.CreateDirectory(targetHostId, targetPath);

            const children = await this.ListDirectoryContents(srcHostId, srcPath);
            for (const child of children)
                await this.Replicate(srcHostId, path.join(srcPath, child), targetHostId, path.join(targetPath, child));
        }
        else
        {
            const data = await this.ReadFile(srcHostId, srcPath);
            await this.WriteFile(targetHostId, targetPath, data);
        }

        await this.ChangeMode(targetHostId, targetPath, status.mode);
    }

    public async StreamFile(hostId: number, filePath: string)
    {
        const conn = await this.remoteConnectionsManager.AcquireConnection(hostId);
        try
        {
            return conn.value.StreamFile(filePath);
        }
        catch(e)
        {
            throw new Error("Reading file at path " + filePath + " on host " + hostId + " failed." + e);
        }
        finally
        {
            conn.Release();
        }
    }

    public async StreamToFile(hostId: number, filePath: string, stream: Readable)
    {
        const conn = await this.remoteConnectionsManager.AcquireConnection(hostId);
        await conn.value.StreamToFile(filePath, stream);
        conn.Release();
    }

    public async UnlinkFile(hostId: number, path: string)
    {
        const conn = await this.remoteConnectionsManager.AcquireConnection(hostId);
        await conn.value.UnlinkFile(path);
        conn.Release();
    }

    public async WriteFile(hostId: number, filePath: string, content: Buffer)
    {
        const conn = await this.remoteConnectionsManager.AcquireConnection(hostId);
        try
        {
            await conn.value.WriteFile(filePath, content);
        }
        catch(e)
        {
            throw new Error("Writing file at path " + filePath + " on host " + hostId + " failed." + e);
        }
        finally
        {
            conn.Release();
        }
    }

    public async WriteTextFile(hostId: number, filePath: string, text: string, mode?: number)
    {
        const conn = await this.remoteConnectionsManager.AcquireConnection(hostId);
        try
        {
            await conn.value.WriteFile(filePath, Buffer.from(text, "utf-8"), mode);
        }
        catch(e)
        {
            throw new Error("Writing text file at path " + filePath + " on host " + hostId + " failed." + e);
        }
        finally
        {
            conn.Release();
        }
    }
}