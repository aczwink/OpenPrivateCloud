/**
 * OpenPrivateCloud
 * Copyright (C) 2019-2024 Amir Czwink (amir130@hotmail.de)
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
import { CollectionViewModel, MultiPageViewModel, ObjectViewModel, RoutingViewModel } from "../../UI/ViewModel";
import { resourceProviders } from "openprivatecloud-common";
import { BuildCommonResourceActions, BuildResourceGeneralPageGroupEntry } from "../shared/resourcegeneral";
import { FileMetaDataDTO, FileRevisionDTO, ObjectStorageBlobIndex, ObjectStoragesStatisticsDTO, SnapshotDTO } from "../../../dist/api";
import { ListViewModel } from "../../UI/ListViewModel";
import { ExtractDataFromResponseOrShowErrorMessageOnError } from "../../UI/ResponseHandler";
import { DownloadFileUsingProgressPopup } from "../../Views/object-storage/DownloadProgressPopup";
import { ObjectStoragePreviewComponent } from "../../Views/object-storage/ObjectStoragePreviewComponent";
import { ObjectStorageSearchComponent } from "../../Views/object-storage/ObjectStorageSearchComponent";

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

const fileExtraMetaDataViewModel: ObjectViewModel<ObjectStorageBlobIndex, FileId> = {
    type: "object",
    actions: [
    ],
    formTitle: _ => "Metadata",
    requestObject: (service, ids) => service.resourceProviders._any_.fileservices.objectstorage._any_.files._any_.extrameta.get(ids.resourceGroupName, ids.resourceName, ids.fileId),
    schemaName: "ObjectStorageBlobIndex"
};

const fileRevisionViewModel: ObjectViewModel<FileMetaDataDTO, FileId & { revisionNumber: number; }> = {
    type: "object",
    actions: [
        {
            type: "activate",
            execute: async (service, ids) => {
                const response = await service.resourceProviders._any_.fileservices.objectstorage._any_.files._any_.revisions._any_.get(ids.resourceGroupName, ids.resourceName, ids.fileId, ids.revisionNumber);
                const result = await ExtractDataFromResponseOrShowErrorMessageOnError(response);
                if(!result.ok)
                    return response;

                return DownloadFileUsingProgressPopup(result.value.fileName, progressTracker => service.resourceProviders._any_.fileservices.objectstorage._any_.files._any_.revisions._any_.blob.get(ids.resourceGroupName, ids.resourceName, ids.fileId, ids.revisionNumber, { progressTracker }));
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
                const response = await service.resourceProviders._any_.fileservices.objectstorage._any_.files._any_.get(ids.resourceGroupName, ids.resourceName, ids.fileId);
                const result = await ExtractDataFromResponseOrShowErrorMessageOnError(response);
                if(!result.ok)
                    return response;

                return DownloadFileUsingProgressPopup(result.value.fileName, progressTracker => service.resourceProviders._any_.fileservices.objectstorage._any_.files._any_.blob.get(ids.resourceGroupName, ids.resourceName, ids.fileId, { progressTracker }));
            },
            matIcon: "download",
            title: "Download"
        },
        {
            type: "edit",
            propertiesSchemaName: "EditableFileMetaDataDTO",
            requestObject: (service, ids) => service.resourceProviders._any_.fileservices.objectstorage._any_.files._any_.meta.get(ids.resourceGroupName, ids.resourceName, ids.fileId),
            updateResource: (service, ids, dto) => service.resourceProviders._any_.fileservices.objectstorage._any_.files._any_.meta.put(ids.resourceGroupName, ids.resourceName, ids.fileId, dto),
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
                    child: {
                        type: "component",
                        component: ObjectStoragePreviewComponent
                    },
                    displayName: "Preview",
                    key: "preview"
                },
                {
                    child: fileExtraMetaDataViewModel,
                    displayName: "Metadata",
                    key: "extrametadata"
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

const fileExplorerViewModel: RoutingViewModel = {
    type: "routing",
    entries: [
        {
            key: "files/:fileId",
            viewModel: fileViewModel,
        },
        {
            key: "",
            viewModel: {
                type: "component",
                component: ObjectStorageSearchComponent
            }
        }
    ]
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

const statisticsViewModel: ObjectViewModel<ObjectStoragesStatisticsDTO, ResourceAndGroupId> = {
    type: "object",
    actions: [],
    formTitle: _ => "Statistics",
    requestObject: (service, ids) => service.resourceProviders._any_.fileservices.objectstorage._any_.stats.get(ids.resourceGroupName, ids.resourceName),
    schemaName: "ObjectStoragesStatisticsDTO"
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
                    child: fileExplorerViewModel,
                    displayName: "File explorer"
                },
                {
                    key: "snapshots",
                    child: snapshotsViewModel,
                    displayName: "Snapshots"
                },
                {
                    key: "stats",
                    child: statisticsViewModel,
                    displayName: "Statistics"
                },
            ]
        },
        BuildResourceGeneralPageGroupEntry(BuildResourceId),
    ],
    formTitle: ids => ids.resourceName,
    type: "multiPage"
};