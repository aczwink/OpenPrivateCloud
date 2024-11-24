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
import { JDownloaderPublicConfig, JdownloaderInfoDto, SMBConnectionInfo } from "../../../dist/api";
import { RouteSetup } from "acfrontendex";
import { BuildCommonResourceActions, BuildResourceGeneralPageGroupEntry } from "../resources-shared/resource-general";
import { Use } from "acfrontend";
import { APIService } from "../../services/APIService";
import { OpenAPISchema } from "../../api-info";

type ResourceAndGroupId = { resourceGroupName: string; resourceName: string };

function BuildResourceId(resourceGroupName: string, resourceName: string)
{
    return "/" + resourceGroupName + "/" + resourceProviders.webServices.name + "/" + resourceProviders.webServices.jdownloaderResourceType.name + "/" + resourceName;
}

const overviewViewModel: RouteSetup<ResourceAndGroupId, JdownloaderInfoDto> = {
    content: {
        type: "object",
        actions: [
            {
                type: "activate",
                execute: ids => Use(APIService).resourceProviders._any_.webservices.jdownloader._any_.post(ids.resourceGroupName, ids.resourceName, { action: "start" }),
                icon: "play",
                title: "Start"
            },
            {
                type: "activate",
                execute: ids => Use(APIService).resourceProviders._any_.webservices.jdownloader._any_.post(ids.resourceGroupName, ids.resourceName, { action: "stop" }),
                icon: "power",
                title: "Stop"
            },
        ],
        formTitle: _ => "Overview",
        requestObject: ids => Use(APIService).resourceProviders._any_.webservices.jdownloader._any_.info.get(ids.resourceGroupName, ids.resourceName),
        schema: OpenAPISchema("JdownloaderInfoDto"),
    },
    displayText: "Overview",
    icon: "binoculars",
    routingKey: "overview",
};

const configViewModel: RouteSetup<ResourceAndGroupId, JDownloaderPublicConfig> = {
    content: {
        type: "object",
        actions: [
            {
                type: "edit",
                requestObject: ids => Use(APIService).resourceProviders._any_.webservices.jdownloader._any_.config.get(ids.resourceGroupName, ids.resourceName),
                schema: OpenAPISchema("JDownloaderPublicConfig"),
                updateResource: (ids, creds) => Use(APIService).resourceProviders._any_.webservices.jdownloader._any_.config.put(ids.resourceGroupName, ids.resourceName, creds),
            }
        ],
        formTitle: _ => "Configuration",
        requestObject: ids => Use(APIService).resourceProviders._any_.webservices.jdownloader._any_.config.get(ids.resourceGroupName, ids.resourceName),
        schema: OpenAPISchema("JDownloaderPublicConfig"),
    },
    displayText: "Config",
    icon: "sliders",
    routingKey: "config",
};

const smbConnectionViewModel: RouteSetup<ResourceAndGroupId, SMBConnectionInfo> = {
    content: {
        type: "object",
        actions: [],
        formTitle: _ => "SMB connection information",
        requestObject: ids => Use(APIService).resourceProviders._any_.webservices.jdownloader._any_.smbconnect.get(ids.resourceGroupName, ids.resourceName),
        schema: OpenAPISchema("SMBConnectionInfo")
    },
    displayText: "SMB connection",
    icon: "link",
    routingKey: "smb-connection",
};

export const jdownloaderViewModel: RouteSetup<ResourceAndGroupId> = {
    content: {
        type: "multiPage",
        actions: [
            ...BuildCommonResourceActions(BuildResourceId)
        ],
        entries: [
            {
                displayName: "",
                entries: [
                    overviewViewModel,
                    configViewModel,
                    smbConnectionViewModel
                ]
            },
            BuildResourceGeneralPageGroupEntry(BuildResourceId),
        ],
        formTitle: ids => ids.resourceName,
    },
    displayText: "JDownloader",
    icon: "cloud-download",
    routingKey: `${resourceProviders.webServices.name}/${resourceProviders.webServices.jdownloaderResourceType.name}/{resourceName}`
};