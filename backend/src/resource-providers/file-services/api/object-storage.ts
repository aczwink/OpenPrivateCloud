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

import { APIController, Common, Get, Header, Path, Put, NotFound, FormField, Body, Delete, Post } from "acts-util-apilib";
import { ResourcesManager } from "../../../services/ResourcesManager";
import { c_fileServicesResourceProviderName, c_objectStorageResourceTypeName } from "openprivatecloud-common/dist/constants";
import { SessionsManager } from "../../../services/SessionsManager";
import { ResourceReference, ResourceReferenceWithSession } from "../../../common/ResourceReference";
import { ResourceAPIControllerBase } from "../../ResourceAPIControllerBase";
import { FileMetaDataRevision, ObjectStoragesManager } from "../ObjectStoragesManager";
import { UploadedFile } from "acts-util-node/dist/http/UploadedFile";

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
}

interface FileMetaDataDTO
{
    fileName: string;
    lastAccessTime: Date;
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
    constructor(resourcesManager: ResourcesManager, private sessionsManager: SessionsManager, private objectStoragesManager: ObjectStoragesManager)
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
        const files = await this.objectStoragesManager.SearchFiles(context.resourceReference);
        return files.map<FileMetaDataOverviewDataDTO>(x => ({
            id: x.id,
            mediaType: x.mediaType,
            size: x.blobSize
        }));
    }

    @Delete("files/{fileId}")
    public async DeleteFile(
        @Common context: ResourceReferenceWithSession,
        @Path fileId: string
    )
    {
        await this.objectStoragesManager.DeleteFile(context.resourceReference, fileId);
    }

    @Get("files/{fileId}")
    public async QueryFile(
        @Common context: ResourceReferenceWithSession,
        @Path fileId: string
    )
    {
        const file = await this.objectStoragesManager.RequestFileMetaData(context.resourceReference, fileId);
        if(file === undefined)
            return NotFound("file not found");
        
        const atime = await this.objectStoragesManager.RequestFileAccessTime(context.resourceReference, fileId);
        return this.MapRevisionToDTO(file.currentRev, atime);
    }

    @Put("files/{fileId}")
    public async SaveFile(
        @Common context: ResourceReferenceWithSession,
        @Path fileId: string,
        @FormField file: UploadedFile
    )
    {
        await this.objectStoragesManager.SaveFile(context.resourceReference, fileId, file.buffer, file.mediaType, file.originalName);
    }

    @Get("files/{fileId}/blob")
    public async DownloadFileBlob(
        @Common context: ResourceReferenceWithSession,
        @Path fileId: string
    )
    {
        return await this.objectStoragesManager.RequestFileBlob(context.resourceReference, fileId)
    }

    @Get("files/{fileId}/revisions/{revisionNumber}")
    public async QueryFileRevision(
        @Common context: ResourceReferenceWithSession,
        @Path fileId: string,
        @Path revisionNumber: number
    )
    {
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
        return await this.objectStoragesManager.RequestFileRevisionBlob(context.resourceReference, fileId, revisionNumber);
    }

    @Get("files/{fileId}/revisions")
    public async QueryFileRevisions(
        @Common context: ResourceReferenceWithSession,
        @Path fileId: string
    )
    {
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
            size: revision.blobSize
        };
    }
}