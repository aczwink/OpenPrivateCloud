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

import { InstancePermission, SMBConfig, SMBConnectionInfo } from "../../../dist/api";
import { APIService } from "../../Services/APIService";
import { MultiPageViewModel, ObjectViewModel } from "../../UI/ViewModel";
import { FileManagerComponent } from "../../Views/file-manager/FileManagerComponent";
import { resourceProviders } from "openprivatecloud-common";
import { PageNotFoundComponent } from "../../PageNotFoundComponent";
import { ListViewModel } from "../../UI/ListViewModel";

type InstanceId = { instanceName: string };

function BuildFullInstanceName(instanceName: string)
{
    return "/" + resourceProviders.fileServices.name + "/" + resourceProviders.fileServices.fileStorageResourceType.name + "/" + instanceName;
}

const accessControlViewModel: ListViewModel<InstancePermission, InstanceId> = {
    actions: [
        {
            type: "create",
            createResource: async (service, ids, permission) => {
                await service.instances.permissions.post({ fullInstanceName: BuildFullInstanceName(ids.instanceName) }, permission)
            }
        }
    ],
    boundActions: [
        {
            type: "delete",
            deleteResource: async (service, ids, permission) => {
                await service.instances.permissions.delete({ fullInstanceName: BuildFullInstanceName(ids.instanceName) }, permission)
            }
        }
    ],
    displayName: "Access control",
    requestObjects: async (service, ids) => (await service.instances.permissions.get({ fullInstanceName: BuildFullInstanceName(ids.instanceName) })).data,
    schemaName: "InstancePermission",
    type: "list",
};

async function QuerySMBConfig(service: APIService, ids: InstanceId)
{
    const response = await service.resourceProviders.fileservices.filestorage._any_.smbcfg.get(ids.instanceName);
    if(response.statusCode === 200)
        return response.data;
    throw new Error("NOT IMPLEMENTED");
}

const smbConfigViewModel: ObjectViewModel<SMBConfig, InstanceId, APIService>  = {
    type: "object",
    actions: [
        {
            type: "edit",
            propertiesSchemaName: "SMBConfig",
            requestObject: QuerySMBConfig,
            updateResource: async (service, ids, cfg) => {
                await service.resourceProviders.fileservices.filestorage._any_.smbcfg.put(ids.instanceName, cfg);
            }
        }
    ],
    formTitle: _ => "SMB config",
    requestObject: QuerySMBConfig,
    schemaName: "SMBConfig",
    service: APIService
};

const smbConnectionViewModel: ObjectViewModel<SMBConnectionInfo, InstanceId, APIService>  = {
    type: "object",
    actions: [],
    formTitle: _ => "SMB connection information",
    requestObject: async (service, ids) => {
        const response = await service.resourceProviders.fileservices.filestorage._any_.smbconnect.get(ids.instanceName);
        if(response.statusCode === 200)
            return response.data;
        throw new Error("NOT IMPLEMENTED");
    },
    schemaName: "SMBConnectionInfo",
    service: APIService
};

export const fileStorageViewModel: MultiPageViewModel<InstanceId, APIService> = {
    actions: [
        {
            type: "delete",
            deleteResource: async (service, ids) => {
                await service.instances.delete({
                    fullInstanceName: BuildFullInstanceName(ids.instanceName)
                })
            }
        }
    ],
    entries: [
        {
            key: "overview",
            child: {
                type: "component",
                component: PageNotFoundComponent
            },
            displayName: "Overview"
        },
        {
            child: accessControlViewModel,
            displayName: "Access control",
            key: "access"
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
            key: "smb-settings",
            child: smbConfigViewModel,
            displayName: "SMB configuration"
        },
        {
            key: "smb-connection",
            child: smbConnectionViewModel,
            displayName: "SMB connection"
        }
    ],
    formTitle: ids => ids.instanceName,
    service: APIService,
    type: "multiPage"
};