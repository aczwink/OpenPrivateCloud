/**
 * OpenPrivateCloud
 * Copyright (C) 2019-2022 Amir Czwink (amir130@hotmail.de)
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

import { DeploymentDataDto, SMBConfig, SMBConnectionInfo, SnapshotDto } from "../../../dist/api";
import { MultiPageViewModel, ObjectViewModel } from "../../UI/ViewModel";
import { FileManagerComponent } from "../../Views/file-manager/FileManagerComponent";
import { resourceProviders } from "openprivatecloud-common";
import { ListViewModel } from "../../UI/ListViewModel";
import { BuildAccessControlPageEntry } from "../shared/accesscontrol";

type InstanceId = { instanceName: string };

function BuildFullInstanceName(instanceName: string)
{
    return "/" + resourceProviders.fileServices.name + "/" + resourceProviders.fileServices.fileStorageResourceType.name + "/" + instanceName;
}

const overviewViewModel: ObjectViewModel<DeploymentDataDto, InstanceId>  = {
    type: "object",
    actions: [],
    formTitle: _ => "Overview",
    requestObject: (service, ids) => service.resourceProviders.fileservices.filestorage._any_.deploymentdata.get(ids.instanceName),
    schemaName: "DeploymentDataDto",
};

const smbConfigViewModel: ObjectViewModel<SMBConfig, InstanceId>  = {
    type: "object",
    actions: [
        {
            type: "edit",
            propertiesSchemaName: "SMBConfig",
            requestObject: (service, ids) => service.resourceProviders.fileservices.filestorage._any_.smbcfg.get(ids.instanceName),
            updateResource: (service, ids, cfg) => service.resourceProviders.fileservices.filestorage._any_.smbcfg.put(ids.instanceName, cfg)
        }
    ],
    formTitle: _ => "SMB config",
    requestObject: (service, ids) => service.resourceProviders.fileservices.filestorage._any_.smbcfg.get(ids.instanceName),
    schemaName: "SMBConfig",
};

const smbConnectionViewModel: ObjectViewModel<SMBConnectionInfo, InstanceId>  = {
    type: "object",
    actions: [],
    formTitle: _ => "SMB connection information",
    requestObject: (service, ids) => service.resourceProviders.fileservices.filestorage._any_.smbconnect.get(ids.instanceName),
    schemaName: "SMBConnectionInfo",
};


const snapshotsViewModel: ListViewModel<SnapshotDto, InstanceId> = {
    actions: [
        {
            type: "create",
            createResource: (service, ids, _) => service.resourceProviders.fileservices.filestorage._any_.snapshots.post(ids.instanceName)
        }
    ],
    boundActions: [],
    displayName: "Snapshots",
    requestObjects: (service, ids) => service.resourceProviders.fileservices.filestorage._any_.snapshots.get(ids.instanceName),
    schemaName: "SnapshotDto",
    type: "list",
};

export const fileStorageViewModel: MultiPageViewModel<InstanceId> = {
    actions: [
        {
            type: "delete",
            deleteResource: (service, ids) => service.instances.delete({ fullInstanceName: BuildFullInstanceName(ids.instanceName) })
        }
    ],
    entries: [
        {
            key: "overview",
            child: overviewViewModel,
            displayName: "Overview"
        },
        BuildAccessControlPageEntry(BuildFullInstanceName),
        {
            key: "file-manager",
            child: {
                type: "component",
                component: FileManagerComponent
            },
            displayName: "File manager"
        },
        {
            key: "smb-settings",
            child: smbConfigViewModel,
            displayName: "SMB configuration"
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
        }
    ],
    formTitle: ids => ids.instanceName,
    type: "multiPage"
};