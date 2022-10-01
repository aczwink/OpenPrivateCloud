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
import { Injectable } from "acts-util-node";
import { RemoteConnectionsManager } from "./RemoteConnectionsManager";

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
        await conn.value.ChangeOwnerAndGroup(path, uid, gid);
        conn.Release();
    }

    public async CreateDirectory(hostId: number, dirPath: string, uid: number)
    {
        const conn = await this.remoteConnectionsManager.AcquireConnection(hostId);
        const result = await conn.value.CreateDirectory(dirPath, uid);
        conn.Release();
        return result;
    }

    public async ListDirectoryContents(hostId: number, dirPath: string)
    {
        const conn = await this.remoteConnectionsManager.AcquireConnection(hostId);
        const result = await conn.value.ListDirectoryContents(dirPath);
        conn.Release();
        return result;
    }

    public async RemoveDirectory(hostId: number, path: string)
    {
        const conn = await this.remoteConnectionsManager.AcquireConnection(hostId);
        await conn.value.RemoveDirectory(path);
        conn.Release();
    }
}