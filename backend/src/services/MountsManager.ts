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
import { FileSystemEntry, fstabParser } from "../common/mount/fstabParser";
import { FileSystemType, MountedFileSytem, StaticFileSystem } from "../common/mount/MountOptions";
import { MountOptionsParser } from "../common/mount/MountOptionsParser";
import { APISchemaService } from "./APISchemaService";
import { RemoteCommandExecutor } from "./RemoteCommandExecutor";
import { RemoteFileSystemManager } from "./RemoteFileSystemManager";
import { RemoteRootFileSystemManager } from "./RemoteRootFileSystemManager";
import { RemoteConnectionsManager } from "./RemoteConnectionsManager";


@Injectable
export class MountsManager
{
    constructor(private remoteCommandExecutor: RemoteCommandExecutor, private remoteFileSystemManager: RemoteFileSystemManager, private apiSchemaService: APISchemaService,
        private remoteRootFileSystemManager: RemoteRootFileSystemManager, private remoteConnectionsManager: RemoteConnectionsManager)
    {
    }
    
    //Public methods
    public async CreateUniqueMountPointAndMount(hostId: number, devicePath: string)
    {
        const mountPoint = await this.CreateUniqueMountPoint(hostId);
        await this.remoteCommandExecutor.ExecuteCommand(["sudo", "mount", devicePath, mountPoint], hostId);

        return mountPoint;
    }

    public async CreateUniqueLocationAndMountFull(hostId: number, type: FileSystemType, source: string, stdin?: string)
    {
        const mountPoint = await this.CreateUniqueMountPoint(hostId);
        const conn = await this.remoteConnectionsManager.AcquireConnection(hostId);

        const channel = await conn.value.ExecuteInteractiveCommand(["sudo", "mount", "-t", type, source, mountPoint]);
        if(stdin !== undefined)
            channel.stdin.write(stdin);

        await new Promise<boolean>( (resolve, reject) => {
            channel.on("exit", code => resolve(code === "0"));
            channel.on("error", reject);
        });

        conn.Release();

        return mountPoint;
    }

    public async QueryMountedFileSystems(hostId: number)
    {
        const json = await this.QueryData(hostId);

        return this.MapChildren(json.filesystems);
    }

    public async QueryMountPoint(hostId: number, devicePath: string)
    {
        const mounted = await this.QueryMountedFileSystems(hostId);
        return mounted.find(x => x.source === devicePath)?.target;
    }

    public async ReadFileSystemTable(hostId: number)
    {
        const input = await this.remoteFileSystemManager.ReadTextFile(hostId, "/etc/fstab");
        const parser = new fstabParser();
        return parser.Parse(input).map(this.MapFSTabEntry.bind(this));
    }

    public async UnmountAndRemoveMountPoint(hostId: number, devicePath: string)
    {
        const pathToRemove = await this.QueryMountPoint(hostId, devicePath);

        for(let i = 0; i < 120; i++)
        {
            await this.TryUnmount(hostId, devicePath);

            const mountPoint = await this.QueryMountPoint(hostId, devicePath);
            if(mountPoint === undefined)
            {
                await this.remoteRootFileSystemManager.RemoveDirectory(hostId, pathToRemove!);
                return;
            }
            await new Promise<void>(resolve => setTimeout(resolve, i * 1000) );
        }
        throw new Error("Failed unmounting file system: " + devicePath);
    }

    //Private methods
    private async CreateUniqueMountPoint(hostId: number)
    {
        const mountPoint = path.join("/media", "opc" + crypto.pseudoRandomBytes(16).toString("hex"));
        await this.remoteRootFileSystemManager.CreateDirectory(hostId, mountPoint);

        return mountPoint;
    }

    private MapChildren(children: any)
    {
        if(children === undefined)
            return [];
        return (children as any[]).Values().Map(fs => this.MapFileSystem(fs).Values()).Flatten().ToArray();
    }

    private MapFileSystem(fs: any): MountedFileSytem[]
    {
        const mnt: MountedFileSytem = {
            fsType: fs.fstype,
            source: fs.source,
            target: fs.target,
            options: fs.options.split(",")
        };
        return [mnt, ...this.MapChildren(fs.children)];
    }

    private MapFSTabEntry(entry: FileSystemEntry): StaticFileSystem
    {
        const optionsParser = new MountOptionsParser(this.apiSchemaService);

        return {
            name: entry.fileSystem,
            properties: {
                dump: entry.dump,
                mountPoint: entry.mountPoint,
                options: optionsParser.MapOptions(entry.type, entry.options),
                pass: entry.pass,
            }
        };
    }

    private async QueryData(hostId: number)
    {
        const { stdOut } = await this.remoteCommandExecutor.ExecuteBufferedCommand(["findmnt", "-AJ"], hostId);
        return JSON.parse(stdOut);
    }

    private async TryUnmount(hostId: number, devicePath: string)
    {
        const mountPoint = await this.QueryMountPoint(hostId, devicePath);
        if(mountPoint === undefined)
            return;

        await this.remoteCommandExecutor.ExecuteCommand(["sudo", "sync", mountPoint], hostId);
        await this.remoteCommandExecutor.ExecuteCommand(["sudo", "umount", devicePath], hostId);
    }
}