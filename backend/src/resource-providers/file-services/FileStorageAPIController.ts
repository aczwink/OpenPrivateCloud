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

import { APIController, Body, Forbidden, Get, Header, NotFound, Path, Put, Query } from "acts-util-apilib";
import path from "path";
import { HostStoragesController } from "../../data-access/HostStoragesController";
import { InstancesController } from "../../data-access/InstancesController";
import { HostUsersManager } from "../../services/HostUsersManager";
import { InstancesManager } from "../../services/InstancesManager";
import { RemoteFileSystemManager } from "../../services/RemoteFileSystemManager";
import { SambaSharesManager } from "./SambaSharesManager";
import { c_fileServicesResourceProviderName, c_fileStorageResourceTypeName } from "openprivatecloud-common/dist/constants";
import { HostsController } from "../../data-access/HostsController";
import { SessionsManager } from "../../services/SessionsManager";
import { FileStoragesManager } from "./FileStoragesManager";

interface FileEntry
{
    fileName: string;
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

@APIController(`resourceProviders/${c_fileServicesResourceProviderName}/${c_fileStorageResourceTypeName}/{instanceName}`)
class FileStorageAPIController
{
    constructor(private remoteFileSystemManager: RemoteFileSystemManager, private instancesController: InstancesController,
        private instancesManager: InstancesManager, private hostStoragesController: HostStoragesController,
        private sambaSharesManager: SambaSharesManager, private hostUsersManager: HostUsersManager, private hostsController: HostsController,
        private sessionsManager: SessionsManager, private fileStoragesManager: FileStoragesManager)
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

        const remotePath = path.join(this.instancesManager.BuildInstanceStoragePath(storage!.path, fullInstanceName), dirPath);
        if(remotePath.length < storage!.path.length)
            return Forbidden("access denied");

        const entries = await this.remoteFileSystemManager.ListDirectoryContents(storage!.hostId, remotePath);
        const mappedEntries: FileEntry[] = entries.map(x => ({
            fileName: x.filename
        }));
        return mappedEntries;
    }

    @Get("smbconnect")
    public async QuerySMBConnectionInfo(
        @Path instanceName: string,
        @Header Authorization: string
    )
    {
        const fullInstanceName = this.instancesManager.CreateUniqueInstanceName(c_fileServicesResourceProviderName, c_fileStorageResourceTypeName, instanceName);
        const instance = await this.instancesController.QueryInstance(fullInstanceName);
        if(instance === undefined)
            return NotFound("instance not found");
        const storage = await this.hostStoragesController.RequestHostStorage(instance.storageId);
        const host = await this.hostsController.RequestHostCredentials(storage!.hostId);
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
        @Path instanceName: string
    )
    {
        const fullInstanceName = this.instancesManager.CreateUniqueInstanceName(c_fileServicesResourceProviderName, c_fileStorageResourceTypeName, instanceName);
        const instance = await this.instancesController.QueryInstance(fullInstanceName);
        if(instance === undefined)
            return NotFound("instance not found");
        const storage = await this.hostStoragesController.RequestHostStorage(instance.storageId);

        const cfg = await this.sambaSharesManager.QueryShareSettings(storage!.hostId, instanceName);
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

    @Put("smbcfg")
    public async UpdateSMBConfig(
        @Path instanceName: string,
        @Body config: SMBConfig
    )
    {
        const fullInstanceName = this.instancesManager.CreateUniqueInstanceName(c_fileServicesResourceProviderName, c_fileStorageResourceTypeName, instanceName);
        const instance = await this.instancesController.QueryInstance(fullInstanceName);
        if(instance === undefined)
            return NotFound("instance not found");
        const storage = await this.hostStoragesController.RequestHostStorage(instance.storageId);
        const hostId = storage!.hostId;

        if(config.enabled)
            await this.fileStoragesManager.UpdateSMBConfig(hostId, fullInstanceName);
        else
            await this.sambaSharesManager.DeleteShare(hostId, instanceName);
    }
}