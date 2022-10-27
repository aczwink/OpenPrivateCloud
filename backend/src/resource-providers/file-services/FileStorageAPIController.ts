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

import { APIController, Common, Body, Forbidden, Get, Header, NotFound, Path, Put, Query, Post } from "acts-util-apilib";
import path from "path";
import ssh2 from "ssh2";
import { HostStoragesController } from "../../data-access/HostStoragesController";
import { InstancesController } from "../../data-access/InstancesController";
import { HostUsersManager } from "../../services/HostUsersManager";
import { InstancesManager } from "../../services/InstancesManager";
import { RemoteFileSystemManager } from "../../services/RemoteFileSystemManager";
import { c_fileServicesResourceProviderName, c_fileStorageResourceTypeName } from "openprivatecloud-common/dist/constants";
import { HostsController } from "../../data-access/HostsController";
import { SessionsManager } from "../../services/SessionsManager";
import { FileStoragesManager } from "./FileStoragesManager";

interface CommonAPIData
{
    fullInstanceName: string;
    hostId: number;
    storagePath: string;
}

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

interface SMBConnectionInfo
{
    /**
     * @format multi-line
     */
    fstab: string;
}

interface SMBConfig
{
    enabled: boolean;
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
        @Common data: CommonAPIData
    )
    {
        await this.fileStoragesManager.CreateSnapshot(data.hostId, data.storagePath, data.fullInstanceName);
    }

    @Common()
    public async ExtractCommonAPIData(
        @Path instanceName: string
    )
    {
        const fullInstanceName = this.instancesManager.CreateUniqueInstanceName(c_fileServicesResourceProviderName, c_fileStorageResourceTypeName, instanceName);
        const instance = await this.instancesController.QueryInstance(fullInstanceName);
        if(instance === undefined)
            return NotFound("instance not found");

        const storage = await this.hostStoragesController.RequestHostStorage(instance.storageId);

        const data: CommonAPIData = {
            fullInstanceName,
            hostId: storage!.hostId,
            storagePath: storage!.path
        };

        return data;
    }

    @Get("contents")
    public async ListDirectoryContents(
        @Common data: CommonAPIData,
        @Query dirPath: string
    )
    {
        const remotePath = path.join(this.instancesManager.BuildInstanceStoragePath(data.storagePath, data.fullInstanceName), "data", dirPath);
        if(remotePath.length < data.storagePath.length)
            return Forbidden("access denied");

        const entries = await this.remoteFileSystemManager.ListDirectoryContents(data.hostId, remotePath);
        const mappedEntries = await entries.Values().Map(this.MapEntry.bind(this, data.hostId, remotePath)).PromiseAll();
        return mappedEntries;
    }

    @Get("deploymentdata")
    public async QueryDeploymentData(
        @Common data: CommonAPIData
    )
    {
        const host = await this.hostsController.RequestHostCredentials(data.hostId);

        const result: DeploymentDataDto = {
            hostName: host!.hostName,
            storagePath: data.storagePath
        };
        return result;
    }

    @Get("smbconnect")
    public async QuerySMBConnectionInfo(
        @Common data: CommonAPIData,
        @Path instanceName: string,
        @Header Authorization: string
    )
    {
        const host = await this.hostsController.RequestHostCredentials(data.hostId);
        const userId = this.sessionsManager.GetUserIdFromAuthHeader(Authorization);
        const userName = this.hostUsersManager.MapUserToLinuxUserName(userId);
        
        const result: SMBConnectionInfo = {
            fstab: `
for /etc/fstab:
//${host!.hostName}/${instanceName} /<some/local/path> cifs noauto,user,_netdev,credentials=/home/<your user>/.smbcredentials/${host!.hostName} 0 0

for /home/<your user>/.smbcredentials/${host!.hostName}:
username=${userName}
password=<your samba pw>
domain=WORKGROUP

protect /home/<your user>/.smbcredentials/${host!.hostName} appropriatly!:
chmod 600 /home/<your user>/.smbcredentials/${host!.hostName}
            `.trim()
        };

        return result;
    }

    @Get("smbcfg")
    public async QuerySMBConfig(
        @Common data: CommonAPIData
    )
    {
        const cfg = await this.fileStoragesManager.QuerySMBConfig(data.hostId, data.fullInstanceName);
        if(cfg === undefined)
        {
            const result: SMBConfig = {
                enabled: false
            };
            return result;
        }

        const result: SMBConfig = {
            enabled: true
        };
        return result;
    }

    @Get("snapshots")
    public async QuerySnapshots(
        @Common data: CommonAPIData
    )
    {
        const snaps = await this.fileStoragesManager.QuerySnapshots(data.hostId, data.storagePath, data.fullInstanceName);
        return snaps.map(x => {
            const res: SnapshotDto = { date: x };
            return res;
        });
    }

    @Put("smbcfg")
    public async UpdateSMBConfig(
        @Common data: CommonAPIData,
        @Path instanceName: string,
        @Body config: SMBConfig
    )
    {
        if(config.enabled)
            await this.fileStoragesManager.UpdateSMBConfig(data.hostId, data.fullInstanceName);
        else
            await this.fileStoragesManager.DeleteSMBConfigIfExists(data.hostId, instanceName);
    }

    //Private methods
    private async MapEntry(hostId: number, remoteDirPath: string, sshEntry: ssh2.FileEntry): Promise<FileEntry>
    {
        const status = await this.remoteFileSystemManager.QueryStatus(hostId, path.join(remoteDirPath, sshEntry.filename));
        const linuxUserName = await this.hostUsersManager.MapHostUserIdToLinuxUserName(hostId, status.uid);

        return {
            fileName: sshEntry.filename,
            type: status.isDirectory() ? "directory" : "file",
            size: status.size,
            userId: this.hostUsersManager.MapLinuxUserNameToUserId(linuxUserName)
        };
    }
}