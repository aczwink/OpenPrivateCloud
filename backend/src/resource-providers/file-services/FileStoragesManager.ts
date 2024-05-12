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
import { GlobalInjector, Injectable } from "acts-util-node";
import { ResourcesManager } from "../../services/ResourcesManager";
import { RemoteFileSystemManager } from "../../services/RemoteFileSystemManager";
import { RemoteCommandExecutor } from "../../services/RemoteCommandExecutor";
import { ResourceConfigController } from "../../data-access/ResourceConfigController";
import { SingleSMBSharePerInstanceProvider } from "./SingleSMBSharePerInstanceProvider";
import { SharedFolderPermissionsManager } from "./SharedFolderPermissionsManager";
import { LightweightResourceReference, ResourceReference } from "../../common/ResourceReference";
import { DeploymentContext, ResourceStateResult } from "../ResourceProvider";
import { ResourceEvent, ResourceEventListener, ResourceEventsManager } from "../../services/ResourceEventsManager";
import { HostUsersManager } from "../../services/HostUsersManager";

interface SMBConfig
{
    enabled: boolean;
    /**
     * Degrades performance but should be enabled when connecting over unsecure networks or when sensitive data is transferred.
     */
    transportEncryption: boolean;
}

export interface FileStorageConfig
{
    smb: SMBConfig;
    snapshotRetentionDays?: number;
};

@Injectable
export class FileStoragesManager implements ResourceEventListener
{
    constructor(private resourcesManager: ResourcesManager, private sharedFolderPermissionsManager: SharedFolderPermissionsManager, private hostUsersManager: HostUsersManager,
        private remoteFileSystemManager: RemoteFileSystemManager, resourceEventsManager: ResourceEventsManager,
        private remoteCommandExecutor: RemoteCommandExecutor, private instanceConfigController: ResourceConfigController,
        private singleSMBSharePerInstanceProvider: SingleSMBSharePerInstanceProvider)
    {
        resourceEventsManager.RegisterListener(this);
    }
    
    //Public methods
    public async CheckResourceHealth(resourceReference: ResourceReference)
    {
        const config = await this.ReadConfig(resourceReference.id);
        if(config.smb.enabled)
        {
            const online = await this.singleSMBSharePerInstanceProvider.IsShareOnline(resourceReference);
            if(!online)
            {
                await this.UpdateSMBConfig(resourceReference, config);
            }
        }

        const fp = await this.resourcesManager.IsResourceStoragePathOwnershipCorrect(resourceReference);
        if(!fp)
        {
            await this.CorrectFileOwnership(resourceReference);
        }
    }

    public async CreateSnapshot(resourceReference: LightweightResourceReference)
    {
        await this.DeleteSnapshotsThatAreOlderThanRetentionPeriod(resourceReference);

        const dataPath = this.GetDataPath(resourceReference);
        const snapsPath = this.GetSnapshotsPath(resourceReference);
        const snapName = new Date().toISOString();
        const fullSnapPath = path.join(snapsPath, snapName);
        
        await this.remoteCommandExecutor.ExecuteCommand(["btrfs", "subvolume", "snapshot", "-r", dataPath, fullSnapPath], resourceReference.hostId);
        await this.remoteCommandExecutor.ExecuteCommand(["sync"], resourceReference.hostId);
    }

    public async DeleteAllSnapshots(resourceReference: LightweightResourceReference)
    {
        const snapshots = await this.QuerySnapshotsOrdered(resourceReference);
        for (const snapshot of snapshots)
            await this.DeleteSnapshot(resourceReference, snapshot.snapshotName);
    }

    public async DeleteResource(resourceReference: ResourceReference)
    {
        await this.UpdateConfig(resourceReference, {
            smb: { enabled: false, transportEncryption: false }
        });
        await this.DeleteAllSnapshots(resourceReference);
        await this.resourcesManager.RemoveResourceStorageDirectory(resourceReference);

        return null;
    }

    public async DeleteSnapshotsThatAreOlderThanRetentionPeriod(resourceReference: LightweightResourceReference)
    {
        const config = await this.ReadConfig(resourceReference.id);
        if(config.snapshotRetentionDays === undefined)
            return;

        const msToDay = 1000 * 60 * 60 * 24;
        const currentDay = Date.now() / msToDay;

        const snapshots = await this.QuerySnapshotsOrdered(resourceReference);
        for (const snapshot of snapshots)
        {
            const snapshotDay = snapshot.creationDate.valueOf() / msToDay;
            if((snapshotDay + config.snapshotRetentionDays) < currentDay)
            {
                await this.DeleteSnapshot(resourceReference, snapshot.snapshotName);
            }
        }
    }

    public async ExternalResourceIdChanged(resourceReference: ResourceReference, oldExternalResourceId: string)
    {
        const config = await this.ReadConfig(resourceReference.id);
        if(config.smb.enabled)
        {
            await this.singleSMBSharePerInstanceProvider.ClearShareIfExisting(resourceReference.hostId, oldExternalResourceId);
            await this.UpdateSMBConfig(resourceReference, config);
        }
    }

    public GetDataPath(resourceReference: LightweightResourceReference)
    {
        const resourcePath = this.resourcesManager.BuildResourceStoragePath(resourceReference);
        return path.join(resourcePath, "data");
    }

    public async GetSMBConnectionInfo(resourceReference: ResourceReference, userId: number)
    {
        return await this.singleSMBSharePerInstanceProvider.GetSMBConnectionInfo(resourceReference, userId);
    }

    public GetSnapshotsPath(resourceReference: LightweightResourceReference)
    {
        const resourcePath = this.resourcesManager.BuildResourceStoragePath(resourceReference);
        return path.join(resourcePath, "snapshots");
    }

    public async ProvideResource(context: DeploymentContext)
    {
        const resourcePath = await this.resourcesManager.CreateResourceStorageDirectory(context.resourceReference);
        await this.remoteFileSystemManager.ChangeMode(context.hostId, resourcePath, 0o775);

        const dataPath = this.GetDataPath(context.resourceReference);
        const snapshotsPath = this.GetSnapshotsPath(context.resourceReference);

        await this.remoteCommandExecutor.ExecuteCommand(["btrfs", "subvolume", "create", dataPath], context.hostId);
        await this.remoteFileSystemManager.ChangeMode(context.hostId, dataPath, 0o770);

        await this.remoteFileSystemManager.CreateDirectory(context.hostId, snapshotsPath);
        await this.remoteFileSystemManager.ChangeMode(context.hostId, snapshotsPath, 0o750);
    }

    public async QueryResourceState(resourceReference: ResourceReference): Promise<ResourceStateResult>
    {
        const config = await this.ReadConfig(resourceReference.id);
        if(config.smb.enabled)
        {
            const online = await this.singleSMBSharePerInstanceProvider.IsShareOnline(resourceReference);
            if(!online)
            {
                return {
                    state: "corrupt",
                    context: "SMB share is not there"
                };
            }
        }

        const fp = await this.resourcesManager.IsResourceStoragePathOwnershipCorrect(resourceReference);
        if(!fp)
        {
            return {
                state: "corrupt",
                context: "incorrect file ownership"
            };
        }
        return "running";
    }

    public async QuerySnapshotsOrdered(resourceReference: LightweightResourceReference)
    {
        const snapsPath = this.GetSnapshotsPath(resourceReference);

        const snapshots = await this.remoteFileSystemManager.ListDirectoryContents(resourceReference.hostId, snapsPath);
        return snapshots.Values().OrderBy(x => x).Map(x => ({
            snapshotName: x,
            creationDate: new Date(x)
        }));
    }

    public async ReadConfig(instanceId: number): Promise<FileStorageConfig>
    {
        const config = await this.instanceConfigController.QueryConfig<FileStorageConfig>(instanceId);
        if(config === undefined)
        {
            return {
                smb: {
                    enabled: false,
                    transportEncryption: false
                }
            };
        }
        return config;
    }

    public async ReceiveResourceEvent(event: ResourceEvent): Promise<void>
    {
        if(event.type === "userCredentialsProvided")
        {
            const ref = await this.resourcesManager.CreateResourceReference(event.resourceId);
            await this.hostUsersManager.UpdateSambaPasswordOnHostIfExisting(ref!.hostId, event.userId, event.secret);
        }
    }

    public async RefreshPermissions(resourceReference: ResourceReference)
    {
        const dataPath = this.GetDataPath(resourceReference);

        const cfg = await this.ReadConfig(resourceReference.id);
        await this.UpdateConfig(resourceReference, cfg);

        //do this after so that groups and users are definitely synced
        await this.sharedFolderPermissionsManager.SetPermissions(resourceReference, dataPath, false);
    }
    
    public async UpdateConfig(resourceReference: ResourceReference, config: FileStorageConfig)
    {
        const result = await this.UpdateSMBConfig(resourceReference, config);
        if(result !== undefined)
            return result;

        await this.WriteConfig(resourceReference.id, config);

        await this.DeleteSnapshotsThatAreOlderThanRetentionPeriod(resourceReference);
    }

    //Private methods
    private async CorrectFileOwnership(resourceReference: ResourceReference)
    {
        const rootPath = this.resourcesManager.BuildResourceStoragePath(resourceReference);
        const dataPath = this.GetDataPath(resourceReference);
        const snapshotsPath = this.GetSnapshotsPath(resourceReference);

        const allPaths = [rootPath, dataPath, snapshotsPath];
        for (const path of allPaths)
            await this.resourcesManager.CorrectResourceStoragePathOwnership(resourceReference, [{ path, recursive: false }]);
    }

    private async DeleteSnapshot(resourceReference: LightweightResourceReference, snapshotName: string)
    {
        const snapshotsPath = this.GetSnapshotsPath(resourceReference);
        const snapshotPath = path.join(snapshotsPath, snapshotName);
        await this.remoteCommandExecutor.ExecuteCommand(["sudo", "btrfs", "subvolume", "delete", snapshotPath], resourceReference.hostId);
    }

    private async WriteConfig(instanceId: number, config: FileStorageConfig)
    {
        await this.instanceConfigController.UpdateOrInsertConfig(instanceId, config);
    }

    private async UpdateSMBConfig(resourceReference: ResourceReference, config: FileStorageConfig)
    {
        return await this.singleSMBSharePerInstanceProvider.UpdateSMBConfig({
            enabled: config.smb.enabled,
            sharePath: this.GetDataPath(resourceReference),
            readOnly: false,
            transportEncryption: config.smb.transportEncryption,
        }, resourceReference);
    }
}