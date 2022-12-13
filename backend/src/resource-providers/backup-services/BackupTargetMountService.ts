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
import { FileSystemInfoService } from "../../services/FileSystemInfoService";
import { MountsManager } from "../../services/MountsManager";
import { ProcessTracker } from "../../services/ProcessTrackerManager";
import { BackupVaultTargetConfig, BackupVaultWebDAVTargetConfig } from "./models";

export type TargetFileSystemType = "btrfs" | "linux" | "limited";
interface MountedBackupTarget
{
    encryptionPassphrase?: string;
    targetFileSystemType: TargetFileSystemType;
    targetPath: string;
    Unmount(): Promise<void>;
}
 
  
@Injectable
export class BackupTargetMountService
{
    constructor(private mountsManager: MountsManager, private fileSystemInfoService: FileSystemInfoService)
    {
    }
    
    //Public methods
    public async MountTarget(hostId: number, target: BackupVaultTargetConfig, processTracker: ProcessTracker): Promise<MountedBackupTarget>
    {
        switch(target.type)
        {
            case "storage-device":
                return await this.MountStorageDeviceIfRequired(hostId, target.storageDevicePath, processTracker);
            case "webdav":
                return await this.MountWebDAVService(hostId, target, processTracker);
        }
    }

    //Private methods
    private async MountStorageDeviceIfRequired(hostId: number, targetStorageDevicePath: string, processTracker: ProcessTracker): Promise<MountedBackupTarget>
    {
        const mountPoint = await this.mountsManager.QueryMountPoint(hostId, targetStorageDevicePath);
        if(mountPoint === undefined)
        {
            const mountPoint = await this.mountsManager.CreateUniqueMountPointAndMount(hostId, targetStorageDevicePath);

            processTracker.Add("Mounted", targetStorageDevicePath, "on", mountPoint);

            return {
                targetFileSystemType: await this.FindFileSystemTypeFromMountPoint(hostId, mountPoint),
                targetPath: mountPoint,
                Unmount: this.UnmountSource.bind(this, hostId, targetStorageDevicePath, processTracker)
            };
        }
        else
        {
            processTracker.Add("Device", targetStorageDevicePath, "already mounted on", mountPoint);

            return {
                targetFileSystemType: await this.FindFileSystemTypeFromMountPoint(hostId, mountPoint),
                targetPath: mountPoint,
                Unmount: async () => {},
            };
        }
    }
    private async FindFileSystemTypeFromMountPoint(hostId: number, mountPoint: string): Promise<"btrfs" | "limited">
    {
        const info = await this.fileSystemInfoService.QueryFileSystemInfoForDirectory(hostId, mountPoint);
        if(info.type === "btrfs")
            return "btrfs";
        return "limited";
    }

    private async MountWebDAVService(hostId: number, target: BackupVaultWebDAVTargetConfig, processTracker: ProcessTracker): Promise<MountedBackupTarget>
    {
        processTracker.Add("Trying to mount webdav service", target.serverUrl, "as", target.userName);
        const mountPoint = await this.mountsManager.CreateUniqueLocationAndMountFull(hostId, "davfs", target.serverUrl, target.userName + "\n" + target.password + "\n");
        processTracker.Add("Mounted", target.serverUrl, "on", mountPoint);

        return {
            encryptionPassphrase: (target.encryptionPassphrase.trim().length > 0) ? target.encryptionPassphrase.trim() : undefined,
            targetFileSystemType: "limited",
            targetPath: mountPoint,
            Unmount: this.UnmountSource.bind(this, hostId, target.serverUrl, processTracker)
        };
    }

    private async UnmountSource(hostId: number, source: string, processTracker: ProcessTracker)
    {
        await this.mountsManager.UnmountAndRemoveMountPoint(hostId, source);
        processTracker.Add("Device", source, "unmounted.");
    }
}