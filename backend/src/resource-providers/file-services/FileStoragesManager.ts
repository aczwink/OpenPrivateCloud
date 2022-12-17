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
import { InstancesController } from "../../data-access/InstancesController";
import { InstancesManager } from "../../services/InstancesManager";
import { RemoteFileSystemManager } from "../../services/RemoteFileSystemManager";
import { RemoteCommandExecutor } from "../../services/RemoteCommandExecutor";
import { InstanceConfigController } from "../../data-access/InstanceConfigController";
import { InstanceContext } from "../../common/InstanceContext";
import { SingleSMBSharePerInstanceProvider } from "./SingleSMBSharePerInstanceProvider";

export interface SMBConfig
{
    enabled: boolean;
}

interface FileStorageConfig
{
    smb: SMBConfig;
};

@Injectable
export class FileStoragesManager
{
    constructor(private instancesManager: InstancesManager, private instancesController: InstancesController,
        private remoteFileSystemManager: RemoteFileSystemManager,
        private remoteCommandExecutor: RemoteCommandExecutor, private instanceConfigController: InstanceConfigController,
        private singleSMBSharePerInstanceProvider: SingleSMBSharePerInstanceProvider)
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

    public GetDataPath(storagePath: string, fullInstanceName: string)
    {
        const instancePath = this.instancesManager.BuildInstanceStoragePath(storagePath, fullInstanceName);
        return path.join(instancePath, "data");
    }

    public async GetSMBConnectionInfo(data: InstanceContext, userId: number)
    {
        return await this.singleSMBSharePerInstanceProvider.GetSMBConnectionInfo(data, userId);
    }

    public GetSnapshotsPath(storagePath: string, fullInstanceName: string)
    {
        const instancePath = this.instancesManager.BuildInstanceStoragePath(storagePath, fullInstanceName);
        return path.join(instancePath, "snapshots");
    }

    public async QuerySMBConfig(instanceId: number)
    {
        const cfg = await this.ReadConfig(instanceId);
        return cfg.smb;
    }

    public async QuerySnapshots(hostId: number, storagePath: string, fullInstanceName: string)
    {
        const snaps = await this.QuerySnapshotsRawOrdered(hostId, storagePath, fullInstanceName);
        return snaps.Map(x => new Date(x)).ToArray();
    }

    public async QuerySnapshotsRawOrdered(hostId: number, storagePath: string, fullInstanceName: string)
    {
        const snapsPath = this.GetSnapshotsPath(storagePath, fullInstanceName);

        const snapshots = await this.remoteFileSystemManager.ListDirectoryContents(hostId, snapsPath);
        return snapshots.Values().Map(x => x.filename).OrderBy(x => x);
    }

    public async RefreshSMBConfig(instanceContext: InstanceContext)
    {
        await this.UpdateSMBConfig(instanceContext, await this.QuerySMBConfig(instanceContext.instanceId));
    }
    
    public async UpdateSMBConfig(instanceContext: InstanceContext, smbConfig: SMBConfig)
    {
        const result = await this.singleSMBSharePerInstanceProvider.UpdateSMBConfig({
            enabled: smbConfig.enabled,
            sharePath: this.GetDataPath(instanceContext.hostStoragePath, instanceContext.fullInstanceName),
            readOnly: false
        }, instanceContext);
        if(result !== undefined)
            return result;

        const config = await this.ReadConfig(instanceContext.instanceId);
        config.smb = smbConfig;
        await this.WriteConfig(instanceContext.instanceId, config);
    }

    //Private methods
    private async ReadConfig(instanceId: number): Promise<FileStorageConfig>
    {
        const config = await this.instanceConfigController.QueryConfig<FileStorageConfig>(instanceId);
        if(config === undefined)
        {
            return {
                smb: {
                    enabled: false
                }
            };
        }
        return config;
    }

    private async WriteConfig(instanceId: number, config: FileStorageConfig)
    {
        await this.instanceConfigController.UpdateOrInsertConfig(instanceId, config);
    }
}