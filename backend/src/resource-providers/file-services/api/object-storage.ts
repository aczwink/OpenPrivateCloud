/**
 * OpenPrivateCloud
 * Copyright (C) 2023-2024 Amir Czwink (amir130@hotmail.de)
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

import { APIController, Common, Get, Header, Path, Put, NotFound, FormField, Body, Delete, Post, Forbidden, Ok, Query } from "acts-util-apilib";
import { ResourcesManager } from "../../../services/ResourcesManager";
import { c_fileServicesResourceProviderName, c_objectStorageResourceTypeName } from "openprivatecloud-common/dist/constants";
import { SessionsManager } from "../../../services/SessionsManager";
import { ResourceReference, ResourceReferenceWithSession } from "../../../common/ResourceReference";
import { ResourceAPIControllerBase } from "../../ResourceAPIControllerBase";
import { FileMetaDataRevision, ObjectStoragesManager, ThumbType } from "../ObjectStoragesManager";
import { UploadedFile } from "acts-util-node/dist/http/UploadedFile";
import { PermissionsManager } from "../../../services/PermissionsManager";
import { permissions } from "openprivatecloud-common";

interface FileCreationDataDTO
{
    fileId: string;
    fileData: UploadedFile;
}

interface FileMetaDataOverviewDataDTO
{
    id: string;
    mediaType: string;
    /**
     * @format byteSize
     */
    size: number;
    lastAccessTime: Date;
}

interface FileMetaDataDTO
{
    fileName: string;
    lastAccessTime: Date;
    mediaType: string;
    /**
     * @format byteSize
     */
    size: number;
}

interface FileRevisionDTO
{
    revisionNumber: number;
    creationTimeStamp: Date;
    fileName: string;
}

interface SnapshotDTO
{
    creationDate: Date;
}

@APIController(`resourceProviders/{resourceGroupName}/${c_fileServicesResourceProviderName}/${c_objectStorageResourceTypeName}/{resourceName}`)
class _api_ extends ResourceAPIControllerBase
{
    constructor(resourcesManager: ResourcesManager, private sessionsManager: SessionsManager, private objectStoragesManager: ObjectStoragesManager, private permissionsManager: PermissionsManager
    )
    {
        super(resourcesManager, c_fileServicesResourceProviderName, c_objectStorageResourceTypeName);
    }

    @Common()
    public async ExtractCommonAPIData(
        @Path resourceGroupName: string,
        @Path resourceName: string,
        @Header Authorization: string
    )
    {
        const ref = await this.FetchResourceReference(resourceGroupName, resourceName);
        if(!(ref instanceof ResourceReference))
            return NotFound("resource not found");

        const res: ResourceReferenceWithSession = {
            resourceReference: ref,
            userId: this.sessionsManager.GetUserIdFromAuthHeader(Authorization)
        }
        return res;
    }

    //Public methods
    @Get("files")
    public async SearchFiles(
        @Common context: ResourceReferenceWithSession,
    )
    {
        const canReadData = await this.permissionsManager.HasUserPermissionOnResourceScope(context.resourceReference, context.userId, permissions.data.read);
        if(!canReadData)
            return Forbidden("access to files denied");

        const files = await this.objectStoragesManager.SearchFiles(context.resourceReference);
        return files.Values().Map(async x => {
            const res: FileMetaDataOverviewDataDTO = {
                id: x.id,
                mediaType: x.mediaType,
                size: x.blobSize,
                lastAccessTime: new Date(await this.objectStoragesManager.RequestFileAccessTime(context.resourceReference, x.id)),
            };
            return res;
        }).PromiseAll();
    }

    @Delete("files/{fileId}")
    public async DeleteFile(
        @Common context: ResourceReferenceWithSession,
        @Path fileId: string
    )
    {
        const canWriteData = await this.permissionsManager.HasUserPermissionOnResourceScope(context.resourceReference, context.userId, permissions.data.write);
        if(!canWriteData)
            return Forbidden("delete access denied");

        await this.objectStoragesManager.DeleteFile(context.resourceReference, fileId);
    }

    @Get("files/{fileId}")
    public async QueryFile(
        @Common context: ResourceReferenceWithSession,
        @Path fileId: string
    )
    {
        const canReadData = await this.permissionsManager.HasUserPermissionOnResourceScope(context.resourceReference, context.userId, permissions.data.read);
        if(!canReadData)
            return Forbidden("access to blob denied");

        const file = await this.objectStoragesManager.RequestFileMetaData(context.resourceReference, fileId);
        if(file === undefined)
            return NotFound("file not found");
        
        const atime = await this.objectStoragesManager.RequestFileAccessTime(context.resourceReference, fileId);
        return this.MapRevisionToDTO(file.currentRev, atime);
    }

    @Get("files/{fileId}/meta")
    public async QueryFileExtraMetadata(
        @Common context: ResourceReferenceWithSession,
        @Path fileId: string
    )
    {
        const canReadData = await this.permissionsManager.HasUserPermissionOnResourceScope(context.resourceReference, context.userId, permissions.data.read);
        if(!canReadData)
            return Forbidden("access to blob denied");

        const file = await this.objectStoragesManager.RequestFileMetaData(context.resourceReference, fileId);
        if(file === undefined)
            return NotFound("file not found");

        return this.objectStoragesManager.RequestExtraMetadata(context.resourceReference, file.currentRev.blobId, file.currentRev.blobSize, file.currentRev.mediaType);
    }

    @Put("files/{fileId}")
    public async SaveFile(
        @Common context: ResourceReferenceWithSession,
        @Path fileId: string,
        @FormField file: UploadedFile
    )
    {
        const canWriteData = await this.permissionsManager.HasUserPermissionOnResourceScope(context.resourceReference, context.userId, permissions.data.write);
        if(!canWriteData)
            return Forbidden("write access denied");

        await this.objectStoragesManager.SaveFile(context.resourceReference, fileId, file.buffer, file.mediaType, file.originalName);
    }

    @Get("files/{fileId}/blob")
    public async DownloadFileBlob(
        @Common context: ResourceReferenceWithSession,
        @Path fileId: string
    )
    {
        const canReadData = await this.permissionsManager.HasUserPermissionOnResourceScope(context.resourceReference, context.userId, permissions.data.read);
        if(!canReadData)
            return Forbidden("access to blob denied");

        const result = await this.objectStoragesManager.RequestFileBlob(context.resourceReference, fileId)
        return Ok(result.stream, {
            "Content-Length": result.size
        });
    }

    @Get("files/{fileId}/createBlobStream")
    public async StreamFileBlob(
        @Common context: ResourceReferenceWithSession,
        @Path fileId: string
    )
    {
        const canReadData = await this.permissionsManager.HasUserPermissionOnResourceScope(context.resourceReference, context.userId, permissions.data.read);
        if(!canReadData)
            return Forbidden("access to blob denied");

        return this.objectStoragesManager.CreateFileBlobStreamRequest(context.resourceReference, context.userId, fileId);
    }

    @Get("files/{fileId}/thumb")
    public async DownloadFileThumb(
        @Common context: ResourceReferenceWithSession,
        @Path fileId: string,
        @Query thumbType: ThumbType
    )
    {
        const canReadData = await this.permissionsManager.HasUserPermissionOnResourceScope(context.resourceReference, context.userId, permissions.data.read);
        if(!canReadData)
            return Forbidden("access to thumbnail denied");

        const result = await this.objectStoragesManager.RequestFileThumbnail(context.resourceReference, fileId, thumbType);
        return result;
    }

    @Get("files/{fileId}/revisions/{revisionNumber}")
    public async QueryFileRevision(
        @Common context: ResourceReferenceWithSession,
        @Path fileId: string,
        @Path revisionNumber: number
    )
    {
        const canReadData = await this.permissionsManager.HasUserPermissionOnResourceScope(context.resourceReference, context.userId, permissions.data.read);
        if(!canReadData)
            return Forbidden("access to revision denied");

        const md = await this.objectStoragesManager.RequestFileMetaData(context.resourceReference, fileId);
        const x = md.revisions[revisionNumber];
        return this.MapRevisionToDTO(x, x.creationTimeStamp);
    }

    @Get("files/{fileId}/revisions/{revisionNumber}/blob")
    public async DownloadFileRevisionBlob(
        @Common context: ResourceReferenceWithSession,
        @Path fileId: string,
        @Path revisionNumber: number
    )
    {
        const canReadData = await this.permissionsManager.HasUserPermissionOnResourceScope(context.resourceReference, context.userId, permissions.data.read);
        if(!canReadData)
            return Forbidden("access to blob denied");

        const result = await this.objectStoragesManager.RequestFileRevisionBlob(context.resourceReference, fileId, revisionNumber);
        return Ok(result.stream, {
            "Content-Length": result.size
        });
    }

    @Get("files/{fileId}/revisions")
    public async QueryFileRevisions(
        @Common context: ResourceReferenceWithSession,
        @Path fileId: string
    )
    {
        const canReadData = await this.permissionsManager.HasUserPermissionOnResourceScope(context.resourceReference, context.userId, permissions.data.read);
        if(!canReadData)
            return Forbidden("access to revisions denied");

        const md = await this.objectStoragesManager.RequestFileMetaData(context.resourceReference, fileId);
        return md.revisions.map<FileRevisionDTO>( (x, i) => ({
            revisionNumber: i,
            creationTimeStamp: new Date(x.creationTimeStamp),
            fileName: x.fileName
        }));
    }

    @Get("snapshots")
    public async QuerySnapshots(
        @Common context: ResourceReferenceWithSession,
    )
    {
        const canReadData = await this.permissionsManager.HasUserPermissionOnResourceScope(context.resourceReference, context.userId, permissions.data.read);
        if(!canReadData)
            return Forbidden("access to snapshots denied");

        const snapshots = await this.objectStoragesManager.RequestSnapshots(context.resourceReference);
        return snapshots.Map<SnapshotDTO>(x => ({
            creationDate: x
        })).ToArray();
    }

    @Post("snapshots")
    public async CreateSnapshot(
        @Common context: ResourceReferenceWithSession,
    )
    {
        const canWriteData = await this.permissionsManager.HasUserPermissionOnResourceScope(context.resourceReference, context.userId, permissions.data.write);
        if(!canWriteData)
            return Forbidden("write access denied");
        
        await this.objectStoragesManager.CreateSnapshot(context.resourceReference);
    }

    //TODO: this is only there for getting the FileCreationData type into the openapi.json :S
    @Get("dummy")
    public dummy(
        @Common context: ResourceReferenceWithSession,
        @Body data: FileCreationDataDTO
    )
    {
        return "dummy";
    }

    //Private methods
    private MapRevisionToDTO(revision: FileMetaDataRevision, atime: number): FileMetaDataDTO
    {
        return {
            fileName: revision.fileName,
            lastAccessTime: new Date(atime),
            mediaType: revision.mediaType,
            size: revision.blobSize
        };
    }
}