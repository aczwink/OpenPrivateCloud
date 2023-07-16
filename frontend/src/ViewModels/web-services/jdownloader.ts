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

import { resourceProviders } from "openprivatecloud-common";
import { JdownloaderInfoDto, MyJDownloaderCredentials, SMBConnectionInfo } from "../../../dist/api";
import { MultiPageViewModel, ObjectViewModel } from "../../UI/ViewModel";
import { BuildAccessControlPageEntry } from "../shared/accesscontrol";

type ResourceAndGroupId = { resourceGroupName: string; resourceName: string };

function BuildResourceId(resourceGroupName: string, resourceName: string)
{
    return "/" + resourceGroupName + "/" + resourceProviders.webServices.name + "/" + resourceProviders.webServices.jdownloaderResourceType.name + "/" + resourceName;
}

const overviewViewModel: ObjectViewModel<JdownloaderInfoDto, ResourceAndGroupId> = {
    type: "object",
    actions: [
        {
            type: "activate",
            execute: (service, ids) => service.resourceProviders._any_.webservices.jdownloader._any_.post(ids.resourceGroupName, ids.resourceName, { action: "start" }),
            matIcon: "play_arrow",
            title: "Start"
        },
        {
            type: "activate",
            execute: (service, ids) => service.resourceProviders._any_.webservices.jdownloader._any_.post(ids.resourceGroupName, ids.resourceName, { action: "stop" }),
            matIcon: "power_settings_new",
            title: "Stop"
        },
    ],
    formTitle: _ => "Overview",
    requestObject: (service, ids) => service.resourceProviders._any_.webservices.jdownloader._any_.info.get(ids.resourceGroupName, ids.resourceName),
    schemaName: "JdownloaderInfoDto"
};

const myjdcredentialsViewModel: ObjectViewModel<MyJDownloaderCredentials, ResourceAndGroupId> = {
    type: "object",
    actions: [
        {
            type: "edit",
            propertiesSchemaName: "MyJDownloaderCredentials",
            requestObject: (service, ids) => service.resourceProviders._any_.webservices.jdownloader._any_.credentials.get(ids.resourceGroupName, ids.resourceName),
            updateResource: (service, ids, creds) => service.resourceProviders._any_.webservices.jdownloader._any_.credentials.put(ids.resourceGroupName, ids.resourceName, creds),
        }
    ],
    formTitle: _ => "MyJD Credentials",
    requestObject: (service, ids) => service.resourceProviders._any_.webservices.jdownloader._any_.credentials.get(ids.resourceGroupName, ids.resourceName),
    schemaName: "MyJDownloaderCredentials"
};

const smbConnectionViewModel: ObjectViewModel<SMBConnectionInfo, ResourceAndGroupId>  = {
    type: "object",
    actions: [],
    formTitle: _ => "SMB connection information",
    requestObject: (service, ids) => service.resourceProviders._any_.webservices.jdownloader._any_.smbconnect.get(ids.resourceGroupName, ids.resourceName),
    schemaName: "SMBConnectionInfo",
};

export const jdownloaderViewModel: MultiPageViewModel<ResourceAndGroupId> = {
    actions: [
        {
            type: "delete",
            deleteResource: (service, ids) => service.resourceGroups._any_.resources.delete(ids.resourceGroupName, { resourceId: BuildResourceId(ids.resourceGroupName, ids.resourceName) })
        }
    ],
    entries: [
        {
            displayName: "",
            entries: [
                {
                    key: "overview",
                    displayName: "Overview",
                    child: overviewViewModel,
                },
                BuildAccessControlPageEntry(BuildResourceId),
                {
                    key: "credentials",
                    displayName: "Credentials",
                    child: myjdcredentialsViewModel
                },
                {
                    key: "smb-connection",
                    child: smbConnectionViewModel,
                    displayName: "SMB connection"
                },
            ]
        }
    ],
    formTitle: ids => ids.resourceName,
    type: "multiPage"
};