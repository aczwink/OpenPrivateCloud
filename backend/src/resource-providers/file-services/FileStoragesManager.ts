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
import path from "path";
import { Injectable } from "acts-util-node";
import { HostStoragesController } from "../../data-access/HostStoragesController";
import { InstancesController } from "../../data-access/InstancesController";
import { PermissionsController } from "../../data-access/PermissionsController";
import { HostUsersManager } from "../../services/HostUsersManager";
import { InstancesManager } from "../../services/InstancesManager";
import { SambaSharesManager } from "./SambaSharesManager";
import { RemoteFileSystemManager } from "../../services/RemoteFileSystemManager";
import { RemoteCommandExecutor } from "../../services/RemoteCommandExecutor";

@Injectable
export class FileStoragesManager
{
    constructor(private permissionsController: PermissionsController, private hostUsersManager: HostUsersManager,
        private sambaSharesManager: SambaSharesManager, private instancesManager: InstancesManager, private instancesController: InstancesController,
        private hostStoragesController: HostStoragesController, private remoteFileSystemManager: RemoteFileSystemManager,
        private remoteCommandExecutor: RemoteCommandExecutor)
    {
    }
    
    //Public methods
    public async CreateSnapshot(hostId: number, storagePath: string, fullInstanceName: string)
    {
        const dataPath = this.GetDataPath(storagePath, fullInstanceName);
        const snapsPath = this.GetSnapshotsPath(storagePath, fullInstanceName);
        const snapName = new Date().toISOString();
        const fullSnapPath = path.join(snapsPath, snapName);
        
        await this.remoteCommandExecutor.ExecuteCommand(["btrfs", "subvolume", "snapshot", "-r", dataPath, fullSnapPath], hostId);
        await this.remoteCommandExecutor.ExecuteCommand(["sync"], hostId);
    }

    public async DeleteSMBConfigIfExists(hostId: number, fullInstanceName: string)
    {
        const share = await this.QuerySMBConfig(hostId, fullInstanceName);
        if(share !== undefined)
            await this.sambaSharesManager.DeleteShare(hostId, share.name);
    }

    public GetDataPath(storagePath: string, fullInstanceName: string)
    {
        const instancePath = this.instancesManager.BuildInstanceStoragePath(storagePath, fullInstanceName);
        return path.join(instancePath, "data");
    }

    public GetSnapshotsPath(storagePath: string, fullInstanceName: string)
    {
        const instancePath = this.instancesManager.BuildInstanceStoragePath(storagePath, fullInstanceName);
        return path.join(instancePath, "snapshots");
    }

    public async QuerySMBConfig(hostId: number, fullInstanceName: string)
    {
        const shareName = this.MapToSMBShareName(fullInstanceName);
        const cfg = await this.sambaSharesManager.QueryShareSettings(hostId, shareName);

        return cfg;
    }

    public async QuerySnapshots(hostId: number, storagePath: string, fullInstanceName: string)
    {
        const snapsPath = this.GetSnapshotsPath(storagePath, fullInstanceName);

        const snapshots = await this.remoteFileSystemManager.ListDirectoryContents(hostId, snapsPath);
        return snapshots.Values().Map(x => x.filename).OrderBy(x => x).Map(x => new Date(x)).ToArray();
    }

    public async UpdateSMBConfigIfExists(hostId: number, fullInstanceName: string)
    {
        const share = await this.QuerySMBConfig(hostId, fullInstanceName);
        if(share !== undefined)
            await this.UpdateSMBConfig(hostId, fullInstanceName);
    }
    
    public async UpdateSMBConfig(hostId: number, fullInstanceName: string)
    {
        const instance = await this.instancesController.QueryInstance(fullInstanceName);
        const storage = await this.hostStoragesController.RequestHostStorage(instance!.storageId);

        const readGroups = await this.permissionsController.QueryGroupsWithPermission(instance!.id, "/data/read");
        await this.hostUsersManager.SyncSambaGroupsMembers(hostId, readGroups.ToArray());
        const readGroupsLinux = readGroups.Map(x => "@" + this.hostUsersManager.MapGroupToLinuxGroupName(x)).ToArray();

        const writeGroups = await this.permissionsController.QueryGroupsWithPermission(instance!.id, "/data/write");
        await this.hostUsersManager.SyncSambaGroupsMembers(hostId, writeGroups.ToArray());
        const writeGroupsLinux = writeGroups.Map(x => "@" + this.hostUsersManager.MapGroupToLinuxGroupName(x)).ToArray();

        await this.sambaSharesManager.SetShare(hostId, {
            readUsers: readGroupsLinux,
            writeUsers: writeGroupsLinux,
            shareName: this.MapToSMBShareName(fullInstanceName),
            sharePath: this.GetDataPath(storage!.path, fullInstanceName)
        });
    }

    //Private methods
    private MapToSMBShareName(fullInstanceName: string)
    {
        return fullInstanceName.substring(1).ReplaceAll("/", "_");
    }
}