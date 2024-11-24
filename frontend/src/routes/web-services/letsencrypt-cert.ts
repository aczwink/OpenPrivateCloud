/**
 * OpenPrivateCloud
 * Copyright (C) 2023-2024 Amir Czwink (amir130@hotmail.de)
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
import { LetsEncryptCertInfoDTO, LetsEncryptConfigDTO, LetsEncryptLogsDTO } from "../../../dist/api";
import { RouteSetup } from "acfrontendex";
import { BuildCommonResourceActions, BuildResourceGeneralPageGroupEntry } from "../resources-shared/resource-general";
import { Use } from "acfrontend";
import { APIService } from "../../services/APIService";
import { OpenAPISchema } from "../../api-info";

type ResourceAndGroupId = { resourceGroupName: string; resourceName: string };

function BuildResourceId(resourceGroupName: string, resourceName: string)
{
    return "/" + resourceGroupName + "/" + resourceProviders.webServices.name + "/" + resourceProviders.webServices.letsencryptCertResourceType.name + "/" + resourceName;
}

const overviewViewModel: RouteSetup<ResourceAndGroupId, LetsEncryptCertInfoDTO> = {
    content: {
        type: "object",
        actions: [],
        formTitle: _ => "Overview",
        requestObject: ids => Use(APIService).resourceProviders._any_.webservices.letsencryptcert._any_.info.get(ids.resourceGroupName, ids.resourceName),
        schema: OpenAPISchema("LetsEncryptCertInfoDTO"),
    },
    displayText: "Overview",
    icon: "binoculars",
    routingKey: "overview",
};

const logsViewModel: RouteSetup<ResourceAndGroupId, LetsEncryptLogsDTO> = {
    content: {
        type: "object",
        actions: [],
        formTitle: _ => "Logs",
        requestObject: ids => Use(APIService).resourceProviders._any_.webservices.letsencryptcert._any_.logs.get(ids.resourceGroupName, ids.resourceName),
        schema: OpenAPISchema("LetsEncryptLogsDTO"),
    },
    displayText: "Logs",
    icon: "journal",
    routingKey: "logs",
};

const configViewModel: RouteSetup<ResourceAndGroupId, LetsEncryptConfigDTO> = {
    content: {
        type: "object",
        actions: [
            {
                type: "edit",
                requestObject: ids => Use(APIService).resourceProviders._any_.webservices.letsencryptcert._any_.config.get(ids.resourceGroupName, ids.resourceName),
                schema: OpenAPISchema("LetsEncryptConfigDTO"),
                updateResource: (ids, newProps) => Use(APIService).resourceProviders._any_.webservices.letsencryptcert._any_.config.put(ids.resourceGroupName, ids.resourceName, newProps),
            }
        ],
        formTitle: _ => "Config",
        requestObject: ids => Use(APIService).resourceProviders._any_.webservices.letsencryptcert._any_.config.get(ids.resourceGroupName, ids.resourceName),
        schema: OpenAPISchema("LetsEncryptConfigDTO"),
    },
    displayText: "Config",
    icon: "sliders",
    routingKey: "config",
};

export const letsEncryptViewModel: RouteSetup<ResourceAndGroupId> = {
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
                    logsViewModel,
                    configViewModel
                ]
            },
            BuildResourceGeneralPageGroupEntry(BuildResourceId),
        ],
        formTitle: ids => ids.resourceName,
    },
    displayText: "LetsEncrypt certificate",
    icon: "patch-check-fill",
    routingKey: `${resourceProviders.webServices.name}/${resourceProviders.webServices.letsencryptCertResourceType.name}/{resourceName}`,
};