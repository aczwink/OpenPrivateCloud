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
import { HostsController } from "../data-access/HostsController";
import { HostStorage, HostStorageCreationProperties } from "../data-access/HostStoragesController";
import { HostUsersManager } from "./HostUsersManager";
import { RemoteCommandExecutor } from "./RemoteCommandExecutor";
import { RemoteFileSystemManager } from "./RemoteFileSystemManager";
import { RemoteRootFileSystemManager } from "./RemoteRootFileSystemManager";

@Injectable
export class HostStoragesManager
{
    constructor(private hostsController: HostsController, private remoteCommandExecutor: RemoteCommandExecutor,
        private remoteFileSystemManager: RemoteFileSystemManager, private hostUsersManager: HostUsersManager,
        private remoteRootFileSystemManager: RemoteRootFileSystemManager)
    {
    }
    
    //Public methods
    public async AddHostStorage(hostId: number, props: HostStorageCreationProperties)
    {
        const fsType = await this.QueryFileSystemInfoForDirectory(hostId, props.path);

        const hostOPCUserId = await this.hostUsersManager.ResolveHostUserId(hostId, "opc");
        const hostNoGroupId = await this.hostUsersManager.ResolveHostGroupId(hostId, "nogroup");
        await this.remoteRootFileSystemManager.ChangeOwnerAndGroup(hostId, props.path, hostOPCUserId, hostNoGroupId);

        await this.remoteFileSystemManager.ChangeMode(hostId, props.path, 0o775);

        await this.hostsController.AddHostStorage(hostId, props, fsType.type);
    }

    public async FindOptimalStorage(hostId: number, desiredFileSystem: "btrfs" | "ext4")
    {
        const hostStorages = await this.hostsController.RequestHostStorages(hostId);
        const filtered = hostStorages.filter(x => x.fileSystemType === desiredFileSystem);
        const storagesWithCapacities = await filtered.Values().Map(this.QueryFreeStorageCapacity.bind(this, hostId)).PromiseAll();

        const maxFreeSize = Math.max(...storagesWithCapacities.map(x => x.info.freeSpace));

        let bestFS = undefined;
        let bestFSScore = 0;

        for (const storageWithCapacity of storagesWithCapacities)
        {
            const score = storageWithCapacity.info.freeSpace / maxFreeSize;
            if(score > bestFSScore)
            {
                bestFSScore = score;
                bestFS = storageWithCapacity.storage.id;
            }
        }

        if(bestFS === undefined)
            throw new Error("no storage could be found");

        return bestFS;
    }

    public async QueryFileSystemInfoForDirectory(hostId: number, path: string)
    {
        const result = await this.remoteCommandExecutor.ExecuteBufferedCommand(["df", "-T", path], hostId);
        const lines = result.stdOut.split("\n");
        lines.pop();
        const line = lines.pop()!;
        const parts = line.split(/[ \t]+/);

        const freeSpace = parseInt(parts[4]);
        const usedSpace = parseInt(parts[3])

        return {
            freeSpace,
            type: parts[1],
            usedSpace,
            totalSize: freeSpace + usedSpace
        };
    }

    //Private methods
    private async QueryFreeStorageCapacity(hostId: number, storage: HostStorage)
    {
        const info = await this.QueryFileSystemInfoForDirectory(hostId, storage.path);
        return {
            storage,
            info
        };
    }
}