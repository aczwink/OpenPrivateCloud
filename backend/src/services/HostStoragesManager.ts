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

import { Injectable } from "acts-util-node";
import { opcSpecialGroups, opcSpecialUsers } from "../common/UserAndGroupDefinitions";
import { HostsController } from "../data-access/HostsController";
import { HostStorage, HostStorageCreationProperties, HostStoragesController } from "../data-access/HostStoragesController";
import { FileSystemInfoService } from "./FileSystemInfoService";
import { HostUsersManager } from "./HostUsersManager";
import { RemoteCommandExecutor } from "./RemoteCommandExecutor";
import { RemoteFileSystemManager } from "./RemoteFileSystemManager";
import { RemoteRootFileSystemManager } from "./RemoteRootFileSystemManager";

interface HostStorageWithInfo extends HostStorage
{
    /**
     * @format multi-line
     */
    healthInfo: string;

    /**
     * @format multi-line
     */
    diskUsage: string;
}

@Injectable
export class HostStoragesManager
{
    constructor(private hostsController: HostsController, private hostStoragesController: HostStoragesController,
        private remoteFileSystemManager: RemoteFileSystemManager, private hostUsersManager: HostUsersManager,
        private remoteRootFileSystemManager: RemoteRootFileSystemManager, private fileSystemInfoService: FileSystemInfoService,
        private remoteCommandExecutor: RemoteCommandExecutor)
    {
    }
    
    //Public methods
    public async AddHostStorage(hostId: number, props: HostStorageCreationProperties)
    {
        const fsType = await this.fileSystemInfoService.QueryFileSystemInfoForDirectory(hostId, props.path);

        const hostOPCUserId = await this.hostUsersManager.ResolveHostUserId(hostId, opcSpecialUsers.host.name);
        const hostOPCGroupId = await this.hostUsersManager.ResolveHostGroupId(hostId, opcSpecialGroups.host.name);
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

    public async QueryStorage(storageId: number): Promise<HostStorageWithInfo | undefined>
    {
        const hostStorage = await this.hostStoragesController.RequestHostStorage(storageId);
        if(hostStorage === undefined)
            return undefined;

        let diskUsage = "";
        let healthInfo = "";
        if(hostStorage.fileSystemType === "btrfs")
        {
            const result = await this.remoteCommandExecutor.ExecuteBufferedCommand(["sudo", "btrfs", "filesystem", "df", hostStorage.path], hostStorage.hostId);
            diskUsage = result.stdOut;

            const result2 = await this.remoteCommandExecutor.ExecuteBufferedCommand(["sudo", "btrfs", "device", "stats", hostStorage.path], hostStorage.hostId);
            healthInfo = result2.stdOut;
        }

        return {
            diskUsage,
            healthInfo,
            ...hostStorage
        };
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