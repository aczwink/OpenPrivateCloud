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

import { DeploymentDataDto, FileStorageConfig, SMBConnectionInfo, SnapshotDto } from "../../../dist/api";
import { MultiPageViewModel, ObjectViewModel } from "../../UI/ViewModel";
import { FileManagerComponent } from "../../Views/file-manager/FileManagerComponent";
import { resourceProviders } from "openprivatecloud-common";
import { ListViewModel } from "../../UI/ListViewModel";
import { BuildAccessControlPageEntry } from "../shared/accesscontrol";
import { BuildCommonResourceActions, BuildResourceGeneralPageGroupEntry } from "../shared/resourcegeneral";

type ResourceAndGroupId = { resourceGroupName: string; resourceName: string };

function BuildResourceId(resourceGroupName: string, resourceName: string)
{
    return "/" + resourceGroupName + "/" + resourceProviders.fileServices.name + "/" + resourceProviders.fileServices.fileStorageResourceType.name + "/" + resourceName;
}

const overviewViewModel: ObjectViewModel<DeploymentDataDto, ResourceAndGroupId>  = {
    type: "object",
    actions: [],
    formTitle: _ => "Overview",
    requestObject: (service, ids) => service.resourceProviders._any_.fileservices.filestorage._any_.deploymentdata.get(ids.resourceGroupName, ids.resourceName),
    schemaName: "DeploymentDataDto",
};

const configViewModel: ObjectViewModel<FileStorageConfig, ResourceAndGroupId>  = {
    type: "object",
    actions: [
        {
            type: "edit",
            propertiesSchemaName: "FileStorageConfig",
            requestObject: (service, ids) => service.resourceProviders._any_.fileservices.filestorage._any_.config.get(ids.resourceGroupName, ids.resourceName),
            updateResource: (service, ids, cfg) => service.resourceProviders._any_.fileservices.filestorage._any_.config.put(ids.resourceGroupName, ids.resourceName, cfg)
        }
    ],
    formTitle: _ => "Configuration",
    requestObject: (service, ids) => service.resourceProviders._any_.fileservices.filestorage._any_.config.get(ids.resourceGroupName, ids.resourceName),
    schemaName: "FileStorageConfig",
};

const smbConnectionViewModel: ObjectViewModel<SMBConnectionInfo, ResourceAndGroupId>  = {
    type: "object",
    actions: [],
    formTitle: _ => "SMB connection information",
    requestObject: (service, ids) => service.resourceProviders._any_.fileservices.filestorage._any_.smbconnect.get(ids.resourceGroupName, ids.resourceName),
    schemaName: "SMBConnectionInfo",
};


const snapshotsViewModel: ListViewModel<SnapshotDto, ResourceAndGroupId> = {
    actions: [
        {
            type: "create",
            createResource: (service, ids, _) => service.resourceProviders._any_.fileservices.filestorage._any_.snapshots.post(ids.resourceGroupName, ids.resourceName)
        }
    ],
    boundActions: [],
    displayName: "Snapshots",
    requestObjects: (service, ids) => service.resourceProviders._any_.fileservices.filestorage._any_.snapshots.get(ids.resourceGroupName, ids.resourceName),
    schemaName: "SnapshotDto",
    type: "list",
};

export const fileStorageViewModel: MultiPageViewModel<ResourceAndGroupId> = {
    actions: [
        ...BuildCommonResourceActions(BuildResourceId),
    ],
    entries: [
        {
            displayName: "",
            entries: [
                {
                    key: "overview",
                    child: overviewViewModel,
                    displayName: "Overview"
                },
                {
                    key: "file-manager",
                    child: {
                        type: "component",
                        component: FileManagerComponent
                    },
                    displayName: "File manager"
                },
                {
                    key: "settings",
                    child: configViewModel,
                    displayName: "Configuration"
                },
                {
                    key: "smb-connection",
                    child: smbConnectionViewModel,
                    displayName: "SMB connection"
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