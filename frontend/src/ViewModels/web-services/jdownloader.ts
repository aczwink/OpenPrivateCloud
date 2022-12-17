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

import { resourceProviders } from "openprivatecloud-common";
import { JdownloaderInfoDto, MyJDownloaderCredentials, SMBConnectionInfo } from "../../../dist/api";
import { MultiPageViewModel, ObjectViewModel } from "../../UI/ViewModel";
import { BuildAccessControlPageEntry } from "../shared/accesscontrol";

type InstanceId = { instanceName: string };

function BuildFullInstanceName(instanceName: string)
{
    return "/" + resourceProviders.webServices.name + "/" + resourceProviders.webServices.jdownloaderResourceType.name + "/" + instanceName;
}

const overviewViewModel: ObjectViewModel<JdownloaderInfoDto, InstanceId> = {
    type: "object",
    actions: [
        {
            type: "activate",
            execute: (service, ids) => service.resourceProviders.webservices.jdownloader._any_.post(ids.instanceName, { action: "start" }),
            matIcon: "play_arrow",
            title: "Start"
        },
        {
            type: "activate",
            execute: (service, ids) => service.resourceProviders.webservices.jdownloader._any_.post(ids.instanceName, { action: "stop" }),
            matIcon: "power_settings_new",
            title: "Stop"
        },
    ],
    formTitle: _ => "Overview",
    requestObject: (service, ids) => service.resourceProviders.webservices.jdownloader._any_.info.get(ids.instanceName),
    schemaName: "JdownloaderInfoDto"
};

const myjdcredentialsViewModel: ObjectViewModel<MyJDownloaderCredentials, InstanceId> = {
    type: "object",
    actions: [
        {
            type: "edit",
            propertiesSchemaName: "MyJDownloaderCredentials",
            requestObject: (service, ids) => service.resourceProviders.webservices.jdownloader._any_.credentials.get(ids.instanceName),
            updateResource: (service, ids, creds) => service.resourceProviders.webservices.jdownloader._any_.credentials.put(ids.instanceName, creds),
        }
    ],
    formTitle: _ => "MyJD Credentials",
    requestObject: (service, ids) => service.resourceProviders.webservices.jdownloader._any_.credentials.get(ids.instanceName),
    schemaName: "MyJDownloaderCredentials"
};

const smbConnectionViewModel: ObjectViewModel<SMBConnectionInfo, InstanceId>  = {
    type: "object",
    actions: [],
    formTitle: _ => "SMB connection information",
    requestObject: (service, ids) => service.resourceProviders.webservices.jdownloader._any_.smbconnect.get(ids.instanceName),
    schemaName: "SMBConnectionInfo",
};

export const jdownloaderViewModel: MultiPageViewModel<InstanceId> = {
    actions: [
        {
            type: "delete",
            deleteResource: (service, ids) => service.instances.delete({ fullInstanceName: BuildFullInstanceName(ids.instanceName) })
        }
    ],
    entries: [
        {
            key: "overview",
            displayName: "Overview",
            child: overviewViewModel,
        },
        BuildAccessControlPageEntry(BuildFullInstanceName),
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
    ],
    formTitle: ids => ids.instanceName,
    type: "multiPage"
};