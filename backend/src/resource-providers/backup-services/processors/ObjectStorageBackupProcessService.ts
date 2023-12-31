/**
 * OpenPrivateCloud
 * Copyright (C) 2023 Amir Czwink (amir130@hotmail.de)
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
import { ResourcesManager } from "../../../services/ResourcesManager";
import { ObjectStorageBackupConfig } from "../models";
import { ProcessTracker } from "../../../services/ProcessTrackerManager";
import { ObjectStoragesManager } from "../../file-services/ObjectStoragesManager";
import { BuildBackupPath } from "./Shared";
import { RemoteRootFileSystemManager } from "../../../services/RemoteRootFileSystemManager";
import { RemoteCommandExecutor } from "../../../services/RemoteCommandExecutor";

@Injectable
export class ObjectStorageBackupProcessService
{
    constructor(private resourcesManager: ResourcesManager, private objectStoragesManager: ObjectStoragesManager, private remoteRootFileSystemManager: RemoteRootFileSystemManager, private remoteCommandExecutor: RemoteCommandExecutor)
    {
    }

    //Public methods
    public async Backup(hostId: number, objectStorage: ObjectStorageBackupConfig, backupTargetPath: string, processTracker: ProcessTracker)
    {
        const sourceRef = await this.resourcesManager.CreateResourceReference(objectStorage.resourceId);
        if(sourceRef === undefined)
        {
            processTracker.Add("ERROR! ObjectStorage not found:", objectStorage.resourceId.toString());
            return;
        }

        if(objectStorage.createSnapshotBeforeBackup)
        {
            processTracker.Add("Creating snapshot for ObjectStorage", sourceRef.externalId);
            await this.objectStoragesManager.CreateSnapshot(sourceRef);
        }

        processTracker.Add("Beginning to backup ObjectStorage", sourceRef.externalId);
        const targetDir = BuildBackupPath(backupTargetPath, sourceRef.id);
        await this.remoteRootFileSystemManager.CreateDirectory(hostId, targetDir);

        const sourceDirPath = this.resourcesManager.BuildResourceStoragePath(sourceRef) + "/";
        const cmd = ["sudo", "rsync", "--archive", "--delete", "--quiet", sourceDirPath, targetDir];
        await this.remoteCommandExecutor.ExecuteCommand(cmd, hostId);

        processTracker.Add("Finished backing up ObjectStorage", sourceRef.externalId);
    }
}