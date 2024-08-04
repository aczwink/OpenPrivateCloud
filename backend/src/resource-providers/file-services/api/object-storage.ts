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

interface EditableFileMetaDataDTO
{
    tags: string[];
}

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
    tags: string[];
}

interface FileMetaDataDTO
{
    fileName: string;
    mediaType: string;
    /**
     * @format byteSize
     */
    size: number;

    accessCounter: number;
    lastAccessTime: Date;
    tags: string[];
}

interface FileRevisionDTO
{
    revisionNumber: number;
    creationTimeStamp: Date;
    fileName: string;
}

interface ObjectStoragesStatisticsDTO
{
    totalFileCount: number;
    /**
     * @format byteSize
     */
    totalBlobSize: number;
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
        @Query name: string,
        @Query mediaType: string,
        @Query tags: string
    )
    {
        const canReadData = await this.permissionsManager.HasUserPermissionOnResourceScope(context.resourceReference, context.userId, permissions.data.read);
        if(!canReadData)
            return Forbidden("access to files denied");

        const files = await this.objectStoragesManager.SearchFiles(context.resourceReference, { name, mediaType, tags: tags.split(",").map(x => x.trim()).filter(x => x.length > 0) });
        return files.Values().Map(async x => {
            const blobMeta = await this.objectStoragesManager.RequestBlobMetadata(context.resourceReference, x.blobId);
            const stats = await this.objectStoragesManager.RequestFileAccessStatistics(context.resourceReference, x.id);
            const res: FileMetaDataOverviewDataDTO = {
                id: x.id,
                mediaType: x.mediaType,
                size: blobMeta.size,
                lastAccessTime: new Date(stats.lastAccessTime),
                tags: x.tags,
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
        
        const stats = await this.objectStoragesManager.RequestFileAccessStatistics(context.resourceReference, fileId);
        return this.MapRevisionToDTO(context.resourceReference, file.currentRev, stats.accessCounter, stats.lastAccessTime);
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

    @Get("files/{fileId}/extrameta")
    public async QueryFileExtraMetadata(
        @Common context: ResourceReferenceWithSession,
        @Path fileId: string
    )
    {
        const canReadData = await this.permissionsManager.HasUserPermissionOnResourceScope(context.resourceReference, context.userId, permissions.data.read);
        if(!canReadData)
            return Forbidden("access to file denied");

        const file = await this.objectStoragesManager.RequestFileMetaData(context.resourceReference, fileId);
        if(file === undefined)
            return NotFound("file not found");

        return this.objectStoragesManager.RequestBlobMetadata(context.resourceReference, file.currentRev.blobId);
    }

    @Get("files/{fileId}/meta")
    public async RequestFileEditableMetadata(
        @Common context: ResourceReferenceWithSession,
        @Path fileId: string
    )
    {
        const canReadData = await this.permissionsManager.HasUserPermissionOnResourceScope(context.resourceReference, context.userId, permissions.data.read);
        if(!canReadData)
            return Forbidden("access to file denied");

        const file = await this.objectStoragesManager.RequestFileMetaData(context.resourceReference, fileId);
        if(file === undefined)
            return NotFound("file not found");

        const res: EditableFileMetaDataDTO = {
            tags: file.currentRev.tags
        };

        return res;
    }

    @Put("files/{fileId}/meta")
    public async UpdateFileEditableMetadata(
        @Common context: ResourceReferenceWithSession,
        @Path fileId: string,
        @Body dto: EditableFileMetaDataDTO
    )
    {
        const canWriteData = await this.permissionsManager.HasUserPermissionOnResourceScope(context.resourceReference, context.userId, permissions.data.write);
        if(!canWriteData)
            return Forbidden("write access denied");

        await this.objectStoragesManager.UpdateFileMetaData(context.resourceReference, fileId, dto.tags);
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
        return this.MapRevisionToDTO(context.resourceReference, x, 0, x.creationTimeStamp);
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

    @Get("stats")
    public async RequestStatistics(
        @Common context: ResourceReferenceWithSession,
    )
    {
        const canReadData = await this.permissionsManager.HasUserPermissionOnResourceScope(context.resourceReference, context.userId, permissions.data.read);
        if(!canReadData)
            return Forbidden("access to statistics denied");

        return await this.objectStoragesManager.QueryStatistics(context.resourceReference) as ObjectStoragesStatisticsDTO;
    }

    @Get("tags")
    public async RequestTags(
        @Common context: ResourceReferenceWithSession,
    )
    {
        const canReadData = await this.permissionsManager.HasUserPermissionOnResourceScope(context.resourceReference, context.userId, permissions.data.read);
        if(!canReadData)
            return Forbidden("access to tags denied");

        const tags = await this.objectStoragesManager.QueryTags(context.resourceReference);
        return tags.ToArray();
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
    private async MapRevisionToDTO(resourceReference: ResourceReference, revision: FileMetaDataRevision, accessCounter: number, atime: number): Promise<FileMetaDataDTO>
    {
        const blobMeta = await this.objectStoragesManager.RequestBlobMetadata(resourceReference, revision.blobId);
        return {
            fileName: revision.fileName,
            lastAccessTime: new Date(atime),
            mediaType: revision.mediaType,
            size: blobMeta.size,
            accessCounter,
            tags: revision.tags
        };
    }
}