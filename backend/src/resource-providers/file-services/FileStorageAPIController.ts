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

import { APIController, Common, Body, Forbidden, Get, Header, NotFound, Path, Put, Query, Post, BadRequest } from "acts-util-apilib";
import path from "path";
import { HostStoragesController } from "../../data-access/HostStoragesController";
import { InstancesController } from "../../data-access/InstancesController";
import { HostUsersManager } from "../../services/HostUsersManager";
import { InstancesManager } from "../../services/InstancesManager";
import { RemoteFileSystemManager } from "../../services/RemoteFileSystemManager";
import { c_fileServicesResourceProviderName, c_fileStorageResourceTypeName } from "openprivatecloud-common/dist/constants";
import { HostsController } from "../../data-access/HostsController";
import { SessionsManager } from "../../services/SessionsManager";
import { FileStorageConfig, FileStoragesManager } from "./FileStoragesManager";
import { InstanceContext } from "../../common/InstanceContext";

interface DeploymentDataDto
{
    hostName: string;
    storagePath: string;
}

interface FileEntry
{
    type: "directory" | "file";
    fileName: string;
    size: number;

    /**
     * @format user
     */
    userId: number;
}

interface SnapshotDto
{
    date: Date;
}

@APIController(`resourceProviders/${c_fileServicesResourceProviderName}/${c_fileStorageResourceTypeName}/{instanceName}`)
class FileStorageAPIController
{
    constructor(private remoteFileSystemManager: RemoteFileSystemManager, private instancesController: InstancesController,
        private instancesManager: InstancesManager, private hostStoragesController: HostStoragesController,
        private hostUsersManager: HostUsersManager, private hostsController: HostsController,
        private sessionsManager: SessionsManager, private fileStoragesManager: FileStoragesManager)
    {
    }

    //Public methods
    @Post("snapshots")
    public async AddSnapshot(
        @Common data: InstanceContext
    )
    {
        await this.fileStoragesManager.CreateSnapshot(data);
    }

    @Common()
    public async ExtractCommonAPIData(
        @Path instanceName: string
    )
    {
        const fullInstanceName = this.instancesManager.CreateUniqueInstanceName(c_fileServicesResourceProviderName, c_fileStorageResourceTypeName, instanceName);
        const instanceContext = await this.instancesManager.CreateInstanceContext(fullInstanceName);
        if(instanceContext === undefined)
            return NotFound("instance not found");

        return instanceContext;
    }

    @Get("contents")
    public async ListDirectoryContents(
        @Common data: InstanceContext,
        @Query dirPath: string
    )
    {
        const remotePath = path.join(this.instancesManager.BuildInstanceStoragePath(data.hostStoragePath, data.fullInstanceName), "data", dirPath);
        if(remotePath.length < data.hostStoragePath.length)
            return Forbidden("access denied");

        const entries = await this.remoteFileSystemManager.ListDirectoryContents(data.hostId, remotePath);
        const mappedEntries = await entries.Values().Map(this.MapEntry.bind(this, data.hostId, remotePath)).PromiseAll();
        return mappedEntries;
    }

    @Get("deploymentdata")
    public async QueryDeploymentData(
        @Common data: InstanceContext
    )
    {
        const host = await this.hostsController.RequestHostCredentials(data.hostId);

        const result: DeploymentDataDto = {
            hostName: host!.hostName,
            storagePath: data.hostStoragePath
        };
        return result;
    }

    @Get("smbconnect")
    public async QuerySMBConnectionInfo(
        @Common data: InstanceContext,
        @Header Authorization: string
    )
    {
        return await this.fileStoragesManager.GetSMBConnectionInfo(data, this.sessionsManager.GetUserIdFromAuthHeader(Authorization));
    }

    @Get("config")
    public async QueryConfig(
        @Common data: InstanceContext
    )
    {
        return await this.fileStoragesManager.ReadConfig(data.instanceId);
    }

    @Get("snapshots")
    public async QuerySnapshots(
        @Common data: InstanceContext
    )
    {
        const snaps = await this.fileStoragesManager.QuerySnapshotsOrdered(data.hostId, data.hostStoragePath, data.fullInstanceName);
        return snaps.Map(x => {
            const res: SnapshotDto = { date: x.creationDate };
            return res;
        }).ToArray();
    }

    @Put("config")
    public async UpdateConfig(
        @Common data: InstanceContext,
        @Body config: FileStorageConfig
    )
    {
        const result = await this.fileStoragesManager.UpdateConfig(data, config);
        if(result === "ErrorNoOneHasAccess")
            return BadRequest("no user has been giving read access to the share");
    }

    //Private methods
    private async MapEntry(hostId: number, remoteDirPath: string, fileName: string): Promise<FileEntry>
    {
        const status = await this.remoteFileSystemManager.QueryStatus(hostId, path.join(remoteDirPath, fileName));
        const linuxUserName = await this.hostUsersManager.MapHostUserIdToLinuxUserName(hostId, status.uid);

        return {
            fileName: fileName,
            type: status.isDirectory() ? "directory" : "file",
            size: status.size,
            userId: this.hostUsersManager.MapLinuxUserNameToUserId(linuxUserName)
        };
    }
}