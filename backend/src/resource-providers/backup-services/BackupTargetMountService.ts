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
import path from "path";
import { Injectable } from "acts-util-node";
import { FileSystemInfoService } from "../../services/FileSystemInfoService";
import { MountsManager } from "../../services/MountsManager";
import { ProcessTracker } from "../../services/ProcessTrackerManager";
import { BackupVaultTargetConfig, BackupVaultWebDAVTargetConfig } from "./models";
import { KeyVaultManager } from "../security-services/KeyVaultManager";

export type TargetFileSystemType = "btrfs" | "linux" | "limited";
export interface MountedBackupTarget
{
    encryptionKeyKeyVaultReference?: string;
    targetFileSystemType: TargetFileSystemType;
    targetPath: string;
    Unmount(): Promise<void>;
}
 
  
@Injectable
export class BackupTargetMountService
{
    constructor(private mountsManager: MountsManager, private fileSystemInfoService: FileSystemInfoService, private keyVaultManager: KeyVaultManager)
    {
    }
    
    //Public methods
    public async MountTarget(hostId: number, target: BackupVaultTargetConfig, processTracker: ProcessTracker): Promise<MountedBackupTarget>
    {
        switch(target.type)
        {
            case "storage-device":
                return await this.MountStorageDeviceIfRequired(hostId, target.storageDeviceUUID, processTracker);
            case "webdav":
                return await this.MountWebDAVService(hostId, target, processTracker);
        }
    }

    //Private methods
    private async MountStorageDeviceIfRequired(hostId: number, storageDeviceUUID: string, processTracker: ProcessTracker): Promise<MountedBackupTarget>
    {
        const targetStorageDevicePath = this.mountsManager.CreateDevicePathForPartition(storageDeviceUUID);
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
        const password = await this.keyVaultManager.ReadSecretFromReference(await this.keyVaultManager.CreateKeyVaultReference(target.password.keyVaultResourceId, "secret", target.password.secretName));

        processTracker.Add("Trying to mount webdav service", target.serverURL, "as", target.userName);
        const mountPoint = await this.mountsManager.CreateUniqueLocationAndMountFull(hostId, "davfs", target.serverURL, target.userName + "\n" + password + "\n");
        processTracker.Add("Mounted", target.serverURL, "on", mountPoint);

        return {
            encryptionKeyKeyVaultReference: (target.encryptionKey === undefined) ? undefined : (await this.keyVaultManager.CreateKeyVaultReference(target.encryptionKey.keyVaultResourceId, "key", target.encryptionKey.keyName)),
            targetFileSystemType: "limited",
            targetPath: path.join(mountPoint, target.rootPath),
            Unmount: this.UnmountSource.bind(this, hostId, target.serverURL, processTracker)
        };
    }

    private async UnmountSource(hostId: number, source: string, processTracker: ProcessTracker)
    {
        await this.mountsManager.UnmountAndRemoveMountPointIfStandard(hostId, source);
        processTracker.Add("Device", source, "unmounted.");
    }
}