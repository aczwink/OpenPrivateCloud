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
import { opcSpecialGroups, opcSpecialUsers } from "../common/UserAndGroupDefinitions";
import { HostsController } from "../data-access/HostsController";
import { HostStorage, HostStorageCreationProperties } from "../data-access/HostStoragesController";
import { FileSystemInfoService } from "./FileSystemInfoService";
import { HostUsersManager } from "./HostUsersManager";
import { RemoteFileSystemManager } from "./RemoteFileSystemManager";
import { RemoteRootFileSystemManager } from "./RemoteRootFileSystemManager";

@Injectable
export class HostStoragesManager
{
    constructor(private hostsController: HostsController,
        private remoteFileSystemManager: RemoteFileSystemManager, private hostUsersManager: HostUsersManager,
        private remoteRootFileSystemManager: RemoteRootFileSystemManager, private fileSystemInfoService: FileSystemInfoService)
    {
    }
    
    //Public methods
    public async AddHostStorage(hostId: number, props: HostStorageCreationProperties)
    {
        const fsType = await this.fileSystemInfoService.QueryFileSystemInfoForDirectory(hostId, props.path);

        const hostOPCUserId = await this.hostUsersManager.ResolveHostUserId(hostId, opcSpecialUsers.host);
        const hostOPCGroupId = await this.hostUsersManager.ResolveHostGroupId(hostId, opcSpecialGroups.host);
        await this.remoteRootFileSystemManager.ChangeOwnerAndGroup(hostId, props.path, hostOPCUserId, hostOPCGroupId);

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

    //Private methods
    private async QueryFreeStorageCapacity(hostId: number, storage: HostStorage)
    {
        const info = await this.fileSystemInfoService.QueryFileSystemInfoForDirectory(hostId, storage.path);
        return {
            storage,
            info
        };
    }
}