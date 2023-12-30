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
import { CollectionViewModel, MultiPageViewModel, ObjectViewModel } from "../../UI/ViewModel";
import { resourceProviders } from "openprivatecloud-common";
import { BuildCommonResourceActions, BuildResourceGeneralPageGroupEntry } from "../shared/resourcegeneral";
import { FileDownloadService, RootInjector } from "acfrontend";
import { FileCreationDataDTO, FileMetaDataDTO, FileMetaDataOverviewDataDTO, FileRevisionDTO, SnapshotDTO } from "../../../dist/api";
import { ListViewModel } from "../../UI/ListViewModel";

type ResourceAndGroupId = { resourceGroupName: string; resourceName: string };
type FileId = ResourceAndGroupId & { fileId: string };

function BuildResourceId(resourceGroupName: string, resourceName: string)
{
    return "/" + resourceGroupName + "/" + resourceProviders.fileServices.name + "/" + resourceProviders.fileServices.objectStorageResourceType.name + "/" + resourceName;
}

const fileOverviewViewModel: ObjectViewModel<FileMetaDataDTO, FileId> = {
    type: "object",
    actions: [
    ],
    formTitle: _ => "Metadata",
    requestObject: (service, ids) => service.resourceProviders._any_.fileservices.objectstorage._any_.files._any_.get(ids.resourceGroupName, ids.resourceName, ids.fileId),
    schemaName: "FileMetaDataDTO"
};

const fileRevisionViewModel: ObjectViewModel<FileMetaDataDTO, FileId & { revisionNumber: number; }> = {
    type: "object",
    actions: [
        {
            type: "activate",
            execute: async (service, ids) => {
                const response1 = await service.resourceProviders._any_.fileservices.objectstorage._any_.files._any_.revisions._any_.get(ids.resourceGroupName, ids.resourceName, ids.fileId, ids.revisionNumber);
                if(response1.statusCode !== 200)
                    throw new Error("TODO: implement me");

                const response2 = await service.resourceProviders._any_.fileservices.objectstorage._any_.files._any_.revisions._any_.blob.get(ids.resourceGroupName, ids.resourceName, ids.fileId, ids.revisionNumber);
                if(response2.statusCode !== 200)
                    throw new Error("TODO: implement me");

                RootInjector.Resolve(FileDownloadService).DownloadBlobAsFile(response2.data, response1.data.fileName);
                return {
                    data: null,
                    rawBody: null,
                    statusCode: 200,
                };
            },
            matIcon: "download",
            title: "Download"
        },
    ],
    formTitle: ids => "Revision " + ids.revisionNumber,
    requestObject: (service, ids) => service.resourceProviders._any_.fileservices.objectstorage._any_.files._any_.revisions._any_.get(ids.resourceGroupName, ids.resourceName, ids.fileId, ids.revisionNumber),
    schemaName: "FileMetaDataDTO"
};

const fileRevisionsViewModel: CollectionViewModel<FileRevisionDTO, FileId> = {
    type: "collection",
    actions: [
    ],
    child: fileRevisionViewModel,
    displayName: "Revisions",
    extractId: x => x.revisionNumber,
    idKey: "revisionNumber",
    requestObjects: (service, ids) => service.resourceProviders._any_.fileservices.objectstorage._any_.files._any_.revisions.get(ids.resourceGroupName, ids.resourceName, ids.fileId),
    schemaName: "FileRevisionDTO"
};

const fileViewModel: MultiPageViewModel<FileId> = {
    type: "multiPage",
    actions: [
        {
            type: "activate",
            execute: async (service, ids) => {
                const response1 = await service.resourceProviders._any_.fileservices.objectstorage._any_.files._any_.get(ids.resourceGroupName, ids.resourceName, ids.fileId);
                if(response1.statusCode !== 200)
                    throw new Error("TODO: implement me");

                const response2 = await service.resourceProviders._any_.fileservices.objectstorage._any_.files._any_.blob.get(ids.resourceGroupName, ids.resourceName, ids.fileId);
                if(response2.statusCode !== 200)
                    throw new Error("TODO: implement me");

                RootInjector.Resolve(FileDownloadService).DownloadBlobAsFile(response2.data, response1.data.fileName);
                return {
                    data: null,
                    rawBody: null,
                    statusCode: 200,
                };
            },
            matIcon: "download",
            title: "Download"
        },
        {
            type: "delete",
            deleteResource: (service, ids) => service.resourceProviders._any_.fileservices.objectstorage._any_.files._any_.delete(ids.resourceGroupName, ids.resourceName, ids.fileId),
        },
    ],
    entries: [
        {
            displayName: "",
            entries: [
                {
                    child: fileOverviewViewModel,
                    displayName: "Overview",
                    key: "overview"
                },
                {
                    child: fileRevisionsViewModel,
                    displayName: "Revisions",
                    key: "revisions"
                },
            ]
        }
    ],
    formTitle: ids => ids.fileId,
};

const filesViewModel: CollectionViewModel<FileMetaDataOverviewDataDTO, ResourceAndGroupId, FileCreationDataDTO> = {
    type: "collection",
    actions: [
        {
            type: "create",
            createResource: (service, ids, data) => service.resourceProviders._any_.fileservices.objectstorage._any_.files._any_.put(ids.resourceGroupName, ids.resourceName, data.fileId, { file: data.fileData }),
            schemaName: "FileCreationDataDTO"
        }
    ],
    child: fileViewModel,
    displayName: "Files",
    extractId: x => x.id,
    idKey: "fileId",
    requestObjects: (service, ids) => service.resourceProviders._any_.fileservices.objectstorage._any_.files.get(ids.resourceGroupName, ids.resourceName),
    schemaName: "FileMetaDataOverviewDataDTO"
};

const snapshotsViewModel: ListViewModel<SnapshotDTO, ResourceAndGroupId> = {
    type: "list",
    actions: [
        {
            type: "create",
            createResource: (service, ids, dto) => service.resourceProviders._any_.fileservices.objectstorage._any_.snapshots.post(ids.resourceGroupName, ids.resourceName),
        }
    ],
    boundActions: [],
    displayName: "Snapshots",
    requestObjects: (service, ids) => service.resourceProviders._any_.fileservices.objectstorage._any_.snapshots.get(ids.resourceGroupName, ids.resourceName),
    schemaName: "SnapshotDTO"
};

export const objectStorageViewModel: MultiPageViewModel<ResourceAndGroupId> = {
    actions: [
        ...BuildCommonResourceActions(BuildResourceId),
    ],
    entries: [
        {
            displayName: "",
            entries: [
                {
                    key: "file-explorer",
                    child: filesViewModel,
                    displayName: "File explorer"
                },
                {
                    key: "snapshots",
                    child: snapshotsViewModel,
                    displayName: "Snapshots"
                },
            ]
        },
        BuildResourceGeneralPageGroupEntry(BuildResourceId),
    ],
    formTitle: ids => ids.resourceName,
    type: "multiPage"
};