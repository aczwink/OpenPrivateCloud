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

import { RouteSetup } from "acfrontendex";
import { DeploymentDataDto, FileStorageConfig, SMBConnectionInfo, SnapshotDto } from "../../../dist/api";
import { resourceProviders } from "openprivatecloud-common";
import { BuildCommonResourceActions, BuildResourceGeneralPageGroupEntry } from "../resources-shared/resource-general";
import { Use } from "acfrontend";
import { APIService } from "../../services/APIService";
import { OpenAPISchema } from "../../api-info";
import { FileManagerComponent } from "../../components/file-manager/FileManagerComponent";

type ResourceAndGroupId = { resourceGroupName: string; resourceName: string };

function BuildResourceId(resourceGroupName: string, resourceName: string)
{
    return "/" + resourceGroupName + "/" + resourceProviders.fileServices.name + "/" + resourceProviders.fileServices.fileStorageResourceType.name + "/" + resourceName;
}

const overviewViewModel: RouteSetup<ResourceAndGroupId, DeploymentDataDto> = {
    content: {
        type: "object",
        actions: [],
        formTitle: _ => "Overview",
        requestObject: ids => Use(APIService).resourceProviders._any_.fileservices.filestorage._any_.deploymentdata.get(ids.resourceGroupName, ids.resourceName),
        schema: OpenAPISchema("DeploymentDataDto"),
    },
    displayText: "Overview",
    icon: "binoculars",
    routingKey: "overview",
};

const configViewModel: RouteSetup<ResourceAndGroupId, FileStorageConfig> = {
    content: {
        type: "object",
        actions: [
            {
                type: "edit",
                requestObject: ids => Use(APIService).resourceProviders._any_.fileservices.filestorage._any_.config.get(ids.resourceGroupName, ids.resourceName),
                schema: OpenAPISchema("FileStorageConfig"),
                updateResource: (ids, cfg) => Use(APIService).resourceProviders._any_.fileservices.filestorage._any_.config.put(ids.resourceGroupName, ids.resourceName, cfg)
            }
        ],
        formTitle: _ => "Configuration",
        requestObject: ids => Use(APIService).resourceProviders._any_.fileservices.filestorage._any_.config.get(ids.resourceGroupName, ids.resourceName),
        schema: OpenAPISchema("FileStorageConfig"),
    },
    displayText: "Configuration",
    icon: "sliders",
    routingKey: "settings",
};

const smbConnectionViewModel: RouteSetup<ResourceAndGroupId, SMBConnectionInfo> = {
    content: {
        type: "object",
        actions: [],
        formTitle: _ => "SMB connection information",
        requestObject: ids => Use(APIService).resourceProviders._any_.fileservices.filestorage._any_.smbconnect.get(ids.resourceGroupName, ids.resourceName),
        schema: OpenAPISchema("SMBConnectionInfo"),
    },
    displayText: "SMB connection",
    icon: "link",
    routingKey: "smb-connection",
};

const createSnapshotRoute: RouteSetup<ResourceAndGroupId, SnapshotDto> = {
    content: {
        type: "create",
        call: (ids, _) => Use(APIService).resourceProviders._any_.fileservices.filestorage._any_.snapshots.post(ids.resourceGroupName, ids.resourceName),
        schema: OpenAPISchema("SnapshotDto"),
    },
    displayText: "Create snapshot",
    icon: "plus",
    routingKey: "create",
};

const snapshotsViewModel: RouteSetup<ResourceAndGroupId, SnapshotDto> = {
    content: {
        type: "list",
        actions: [
            createSnapshotRoute
        ],
        boundActions: [],
        requestObjects: ids => Use(APIService).resourceProviders._any_.fileservices.filestorage._any_.snapshots.get(ids.resourceGroupName, ids.resourceName),
        schema: OpenAPISchema("SnapshotDto"),
    },
    displayText: "Snapshots",
    icon: "stopwatch",
    routingKey: "snapshots"
};

export const fileStorageViewModel: RouteSetup<ResourceAndGroupId> = {
    content: {
        type: "multiPage",
        actions: [
            ...BuildCommonResourceActions(BuildResourceId),
        ],
        entries: [
            {
                displayName: "",
                entries: [
                    overviewViewModel,
                    {
                        content: {
                            type: "component",
                            component: FileManagerComponent
                        },
                        displayText: "File manager",
                        icon: "files",
                        routingKey: "file-manager",
                    },
                    configViewModel,
                    smbConnectionViewModel,
                    snapshotsViewModel
                ]
            },
            BuildResourceGeneralPageGroupEntry(BuildResourceId),
        ],
        formTitle: ids => ids.resourceName,
    },
    displayText: "File storage",
    icon: "folder-fill",
    routingKey: `${resourceProviders.fileServices.name}/${resourceProviders.fileServices.fileStorageResourceType.name}/{resourceName}`
};