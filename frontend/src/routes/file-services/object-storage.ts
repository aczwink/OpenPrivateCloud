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
import { resourceProviders } from "openprivatecloud-common";
import { FileMetaDataDTO, FileRevisionDTO, ObjectStorageBlobIndex, ObjectStoragesStatisticsDTO, SnapshotDTO } from "../../../dist/api";
import { APIResponseHandler, RouteSetup } from "acfrontendex";
import { BuildCommonResourceActions, BuildResourceGeneralPageGroupEntry } from "../resources-shared/resource-general";
import { Use } from "acfrontend";
import { APIService } from "../../services/APIService";
import { OpenAPISchema } from "../../api-info";
import { ObjectStorageSearchComponent } from "../../components/object-storage/ObjectStorageSearchComponent";
import { DownloadFileUsingProgressPopup } from "../../components/object-storage/DownloadProgressPopup";
import { ObjectStoragePreviewComponent } from "../../components/object-storage/ObjectStoragePreviewComponent";

type ResourceAndGroupId = { resourceGroupName: string; resourceName: string };
type FileId = ResourceAndGroupId & { fileId: string };

function BuildResourceId(resourceGroupName: string, resourceName: string)
{
    return "/" + resourceGroupName + "/" + resourceProviders.fileServices.name + "/" + resourceProviders.fileServices.objectStorageResourceType.name + "/" + resourceName;
}

const fileOverviewViewModel: RouteSetup<FileId, FileMetaDataDTO> = {
    content: {
        type: "object",
        actions: [
        ],
        formTitle: _ => "Metadata",
        requestObject: ids => Use(APIService).resourceProviders._any_.fileservices.objectstorage._any_.files._any_.get(ids.resourceGroupName, ids.resourceName, ids.fileId),
        schema: OpenAPISchema("FileMetaDataDTO"),
    },
    displayText: "Overview",
    icon: "binoculars",
    routingKey: "overview",
};

const fileExtraMetaDataViewModel: RouteSetup<FileId, ObjectStorageBlobIndex> = {
    content: {
        type: "object",
        actions: [
        ],
        formTitle: _ => "Metadata",
        requestObject: ids => Use(APIService).resourceProviders._any_.fileservices.objectstorage._any_.files._any_.extrameta.get(ids.resourceGroupName, ids.resourceName, ids.fileId),
        schema: OpenAPISchema("ObjectStorageBlobIndex")
    },
    displayText: "Metadata",
    icon: "info-square",
    routingKey: "extrametadata",
};

const fileRevisionViewModel: RouteSetup<FileId & { revisionNumber: number; }, FileMetaDataDTO> = {
    content: {
        type: "object",
        actions: [
            {
                type: "activate",
                execute: async ids => {
                    const response = await Use(APIService).resourceProviders._any_.fileservices.objectstorage._any_.files._any_.revisions._any_.get(ids.resourceGroupName, ids.resourceName, ids.fileId, ids.revisionNumber);
                    const result = await Use(APIResponseHandler).ExtractDataFromResponseOrShowErrorMessageOnError(response);
                    if(!result.ok)
                        return response;
    
                    return DownloadFileUsingProgressPopup(result.value.fileName, progressTracker => Use(APIService).resourceProviders._any_.fileservices.objectstorage._any_.files._any_.revisions._any_.blob.get(ids.resourceGroupName, ids.resourceName, ids.fileId, ids.revisionNumber, { progressTracker }));
                },
                icon: "download",
                title: "Download"
            },
        ],
        formTitle: ids => "Revision " + ids.revisionNumber,
        requestObject: (ids) => Use(APIService).resourceProviders._any_.fileservices.objectstorage._any_.files._any_.revisions._any_.get(ids.resourceGroupName, ids.resourceName, ids.fileId, ids.revisionNumber),
        schema: OpenAPISchema("FileMetaDataDTO"),
    },
    displayText: "Revision",
    icon: "journal",
    routingKey: "{revisionNumber}",
};

const fileRevisionsViewModel: RouteSetup<FileId, FileRevisionDTO> = {
    content: {
        type: "collection",
        actions: [
        ],
        child: fileRevisionViewModel,
        id: "revisionNumber",
        requestObjects: ids => Use(APIService).resourceProviders._any_.fileservices.objectstorage._any_.files._any_.revisions.get(ids.resourceGroupName, ids.resourceName, ids.fileId),
        schema: OpenAPISchema("FileRevisionDTO"),
    },
    displayText: "Revisions",
    icon: "journal",
    routingKey: "revisions"
};

const fileViewModel: RouteSetup<FileId> = {
    content: {
        type: "multiPage",
        actions: [
            {
                type: "activate",
                execute: async ids => {
                    const response = await Use(APIService).resourceProviders._any_.fileservices.objectstorage._any_.files._any_.get(ids.resourceGroupName, ids.resourceName, ids.fileId);
                    const result = await Use(APIResponseHandler).ExtractDataFromResponseOrShowErrorMessageOnError(response);
                    if(!result.ok)
                        return response;
    
                    return DownloadFileUsingProgressPopup(result.value.fileName, progressTracker => Use(APIService).resourceProviders._any_.fileservices.objectstorage._any_.files._any_.blob.get(ids.resourceGroupName, ids.resourceName, ids.fileId, { progressTracker }));
                },
                icon: "download",
                title: "Download"
            },
            {
                type: "edit",
                requestObject: ids => Use(APIService).resourceProviders._any_.fileservices.objectstorage._any_.files._any_.meta.get(ids.resourceGroupName, ids.resourceName, ids.fileId),
                schema: OpenAPISchema("EditableFileMetaDataDTO"),
                updateResource: (ids, dto) => Use(APIService).resourceProviders._any_.fileservices.objectstorage._any_.files._any_.meta.put(ids.resourceGroupName, ids.resourceName, ids.fileId, dto),
            },
            {
                type: "delete",
                deleteResource: ids => Use(APIService).resourceProviders._any_.fileservices.objectstorage._any_.files._any_.delete(ids.resourceGroupName, ids.resourceName, ids.fileId),
            },
        ],
        entries: [
            {
                displayName: "",
                entries: [
                    fileOverviewViewModel,
                    {
                        content: {
                            type: "component",
                            component: ObjectStoragePreviewComponent,
                        },
                        displayText: "Preview",
                        icon: "tv",
                        routingKey: "preview",
                    },
                    fileExtraMetaDataViewModel,
                    fileRevisionsViewModel
                ]
            }
        ],
        formTitle: ids => ids.fileId,
    },
    displayText: "File",
    icon: "file",
    routingKey: "files/{fileId}",
};

const fileExplorerViewModel: RouteSetup = {
    content: {
        type: "routing",
        entries: [
            fileViewModel,
            {
                content: {
                    type: "component",
                    component: ObjectStorageSearchComponent
                },
                displayText: "Search",
                icon: "search",
                routingKey: "",
            }
        ],
    },
    displayText: "File explorer",
    icon: "files",
    routingKey: "file-explorer",
};

const createSnapshotRoute: RouteSetup<ResourceAndGroupId, SnapshotDTO> = {
    content: {
        type: "create",
        call: (ids, dto) => Use(APIService).resourceProviders._any_.fileservices.objectstorage._any_.snapshots.post(ids.resourceGroupName, ids.resourceName),
        schema: OpenAPISchema("SnapshotDTO"),
    },
    displayText: "Create snapshot",
    icon: "plus",
    routingKey: "create",
};

const snapshotsViewModel: RouteSetup<ResourceAndGroupId, SnapshotDTO> = {
    content: {
        type: "list",
        actions: [
            createSnapshotRoute
        ],
        boundActions: [],
        requestObjects: ids => Use(APIService).resourceProviders._any_.fileservices.objectstorage._any_.snapshots.get(ids.resourceGroupName, ids.resourceName),
        schema: OpenAPISchema("SnapshotDTO")
    },
    displayText: "Snapshots",
    icon: "stopwatch",
    routingKey: "snapshots"
};

const statisticsViewModel: RouteSetup<ResourceAndGroupId, ObjectStoragesStatisticsDTO> = {
    content: {
        type: "object",
        actions: [],
        formTitle: _ => "Statistics",
        requestObject: ids => Use(APIService).resourceProviders._any_.fileservices.objectstorage._any_.stats.get(ids.resourceGroupName, ids.resourceName),
        schema: OpenAPISchema("ObjectStoragesStatisticsDTO")
    },
    displayText: "Statistics",
    icon: "graph-up",
    routingKey: "stats"
};

export const objectStorageViewModel: RouteSetup<ResourceAndGroupId> = {
    content: {
        type: "multiPage",
        actions: [
            ...BuildCommonResourceActions(BuildResourceId),
        ],
        entries: [
            {
                displayName: "",
                entries: [
                    fileExplorerViewModel,
                    snapshotsViewModel,
                    statisticsViewModel
                ]
            },
            BuildResourceGeneralPageGroupEntry(BuildResourceId),
        ],
        formTitle: ids => ids.resourceName,
    },
    displayText: "Object storage",
    icon: "folder2",
    routingKey: `${resourceProviders.fileServices.name}/${resourceProviders.fileServices.objectStorageResourceType.name}/{resourceName}`
};