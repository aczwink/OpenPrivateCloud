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

import { APIController, Forbidden, Get, NotFound, Path, Query } from "acts-util-apilib";
import path from "path";
import { HostStoragesController } from "../../data-access/HostStoragesController";
import { InstancesController } from "../../data-access/InstancesController";
import { InstancesManager } from "../../services/InstancesManager";
import { RemoteFileSystemManager } from "../../services/RemoteFileSystemManager";
import { c_fileServicesResourceProviderName, c_fileStorageResourceTypeName } from "./constants";

interface FileEntry
{
    fileName: string;
}

@APIController(`resourceProviders/${c_fileServicesResourceProviderName}/${c_fileStorageResourceTypeName}/{instanceName}`)
class FileStorageAPIController
{
    constructor(private remoteFileSystemManager: RemoteFileSystemManager, private instancesController: InstancesController,
        private instancesManager: InstancesManager, private hostStoragesController: HostStoragesController)
    {
    }

    @Get()
    public async ListDirectoryContents(
        @Path instanceName: string,
        @Query dirPath: string
    )
    {
        const fullInstanceName = this.instancesManager.CreateUniqueInstanceName(c_fileServicesResourceProviderName, c_fileStorageResourceTypeName, instanceName);
        const instance = await this.instancesController.QueryInstance(fullInstanceName);
        if(instance === undefined)
            return NotFound("instance not found");

        const storage = await this.hostStoragesController.RequestHostStorage(instance.storageId);

        const remotePath = path.join(this.instancesManager.CreateInstanceStoragePath(storage!.path, fullInstanceName), dirPath);
        if(remotePath.length < storage!.path.length)
            return Forbidden("access denied");

        const entries = await this.remoteFileSystemManager.ListDirectoryContents(storage!.hostId, remotePath);
        const mappedEntries: FileEntry[] = entries.map(x => ({
            fileName: x.filename
        }));
        return mappedEntries;
    }
}