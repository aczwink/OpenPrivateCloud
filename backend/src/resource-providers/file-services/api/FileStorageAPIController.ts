/**
 * OpenPrivateCloud
 * Copyright (C) 2019-2025 Amir Czwink (amir130@hotmail.de)
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

import { APIController, Common, Body, Forbidden, Get, Path, Put, Query, Post, BadRequest, NotFound, Auth } from "acts-util-apilib";
import path from "path";
import { HostUsersManager } from "../../../services/HostUsersManager";
import { ResourcesManager } from "../../../services/ResourcesManager";
import { RemoteFileSystemManager } from "../../../services/RemoteFileSystemManager";
import { c_fileServicesResourceProviderName, c_fileStorageResourceTypeName } from "openprivatecloud-common/dist/constants";
import { FileStorageConfig, FileStoragesManager } from "../FileStoragesManager";
import { ResourceReference, ResourceReferenceWithSession } from "../../../common/ResourceReference";
import { ResourceAPIControllerBase } from "../../ResourceAPIControllerBase";
import { PermissionsManager } from "../../../services/PermissionsManager";
import { permissions } from "openprivatecloud-common";
import { DateTime } from "acts-util-node";
import { AccessToken } from "../../../api_security";
import { UsersManager } from "../../../services/UsersManager";

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
    opcUserId: number;
}

interface SnapshotDto
{
    date: DateTime;
}

@APIController(`resourceProviders/{resourceGroupName}/${c_fileServicesResourceProviderName}/${c_fileStorageResourceTypeName}/{resourceName}`)
class FileStorageAPIController extends ResourceAPIControllerBase
{
    constructor(private remoteFileSystemManager: RemoteFileSystemManager, resourcesManager: ResourcesManager, private hostUsersManager: HostUsersManager, private permissionsManager: PermissionsManager,
        private fileStoragesManager: FileStoragesManager, private usersManager: UsersManager)
    {
        super(resourcesManager, c_fileServicesResourceProviderName, c_fileStorageResourceTypeName);
    }

    @Common()
    public async ExtractCommonAPIData(
        @Path resourceGroupName: string,
        @Path resourceName: string,
        @Auth("jwt") accessToken: AccessToken
    )
    {
        const ref = await this.FetchResourceReference(resourceGroupName, resourceName);
        if(!(ref instanceof ResourceReference))
            return NotFound("resource not found");

        const res: ResourceReferenceWithSession = {
            resourceReference: ref,
            opcUserId: await this.usersManager.MapOAuth2SubjectToOPCUserId(accessToken.sub)
        }
        return res;
    }

    //Public methods
    @Post("snapshots")
    public async AddSnapshot(
        @Common context: ResourceReferenceWithSession
    )
    {
        await this.fileStoragesManager.CreateSnapshot(context.resourceReference);
    }

    @Get("contents")
    public async ListDirectoryContents(
        @Common context: ResourceReferenceWithSession,
        @Query dirPath: string
    )
    {
        const hasPermission = await this.permissionsManager.HasUserPermissionOnResourceScope(context.resourceReference, context.opcUserId, permissions.data.read);
        if(!hasPermission)
            return Forbidden("access denied");

        const remotePath = this.fileStoragesManager.GetFullHostPathTo(context.resourceReference, dirPath);
        if(remotePath.length < context.resourceReference.hostStoragePath.length)
            return Forbidden("access denied");

        const entries = await this.remoteFileSystemManager.ListDirectoryContents(context.resourceReference.hostId, remotePath);
        const mappedEntries = await entries.Values().Map(this.MapEntry.bind(this, context.resourceReference.hostId, remotePath)).PromiseAll();
        return mappedEntries;
    }

    @Get("deploymentdata")
    public async QueryDeploymentData(
        @Common context: ResourceReferenceWithSession
    )
    {
        const result: DeploymentDataDto = {
            hostName: context.resourceReference.hostName,
            storagePath: context.resourceReference.hostStoragePath
        };
        return result;
    }

    @Get("smbconnect")
    public async QuerySMBConnectionInfo(
        @Common context: ResourceReferenceWithSession,
        @Auth("jwt") accessToken: AccessToken
    )
    {
        const opcUserId = await this.usersManager.MapOAuth2SubjectToOPCUserId(accessToken.sub);
        return await this.fileStoragesManager.GetSMBConnectionInfo(context.resourceReference, opcUserId);
    }

    @Get("config")
    public async QueryConfig(
        @Common context: ResourceReferenceWithSession
    )
    {
        return await this.fileStoragesManager.ReadConfig(context.resourceReference.id);
    }

    @Get("snapshots")
    public async QuerySnapshots(
        @Common context: ResourceReferenceWithSession
    )
    {
        const snaps = await this.fileStoragesManager.QuerySnapshotsOrdered(context.resourceReference);
        return snaps.Map(x => {
            const res: SnapshotDto = { date: x.creationDate };
            return res;
        }).ToArray();
    }

    @Put("config")
    public async UpdateConfig(
        @Common context: ResourceReferenceWithSession,
        @Body config: FileStorageConfig
    )
    {
        const result = await this.fileStoragesManager.UpdateConfig(context.resourceReference, config);
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
            opcUserId: this.hostUsersManager.MapLinuxUserNameToUserId(linuxUserName)
        };
    }
}