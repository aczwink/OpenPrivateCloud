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

import { APIController, Common, Get, Header, Path, Put, NotFound, FormField, Body, Delete } from "acts-util-apilib";
import { ResourcesManager } from "../../../services/ResourcesManager";
import { c_fileServicesResourceProviderName, c_objectStorageResourceTypeName } from "openprivatecloud-common/dist/constants";
import { SessionsManager } from "../../../services/SessionsManager";
import { ResourceReference, ResourceReferenceWithSession } from "../../../common/ResourceReference";
import { ResourceAPIControllerBase } from "../../ResourceAPIControllerBase";
import { ObjectStoragesManager } from "../ObjectStoragesManager";
import { UploadedFile } from "acts-util-node/dist/http/UploadedFile";

interface FileCreationData
{
    fileId: string;
    fileData: UploadedFile;
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
    @Get("blobs/{blobId}")
    public async DownloadFileBlob(
        @Common context: ResourceReferenceWithSession,
        @Path blobId: string
    )
    {
        return await this.objectStoragesManager.QueryBlob(context.resourceReference, blobId)
    }

    @Get("files")
    public async SearchFiles(
        @Common context: ResourceReferenceWithSession,
    )
    {
        const files = await this.objectStoragesManager.SearchFiles(context.resourceReference);
        return files;
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
        const file = await this.objectStoragesManager.QueryFileMetaData(context.resourceReference, fileId);
        if(file === undefined)
            return NotFound("file not found");
        return file;
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

    //TODO: this is only there for getting the FileCreationData type into the openapi.json :S
    @Get("dummy")
    public dummy(
        @Common context: ResourceReferenceWithSession,
        @Body data: FileCreationData
    )
    {
        return "dummy";
    }
}