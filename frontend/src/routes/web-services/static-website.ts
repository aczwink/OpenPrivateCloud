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
import { StaticWebsiteConfig, StaticWebsiteInfoDto } from "../../../dist/api";
import { RouteSetup } from "acfrontendex";
import { BuildCommonResourceActions, BuildResourceGeneralPageGroupEntry } from "../resources-shared/resource-general";
import { Use } from "acfrontend";
import { APIService } from "../../services/APIService";
import { OpenAPISchema } from "../../api-info";

type ResourceAndGroupId = { resourceGroupName: string; resourceName: string };

function BuildResourceId(resourceGroupName: string, resourceName: string)
{
    return "/" + resourceGroupName + "/" + resourceProviders.webServices.name + "/" + resourceProviders.webServices.staticWebsiteResourceType.name + "/" + resourceName;
}

const overviewViewModel: RouteSetup<ResourceAndGroupId, StaticWebsiteInfoDto> = {
    content: {
        type: "object",
        actions: [],
        formTitle: _ => "Overview",
        requestObject: ids => Use(APIService).resourceProviders._any_.webservices.staticwebsite._any_.info.get(ids.resourceGroupName, ids.resourceName),
        schema: OpenAPISchema("StaticWebsiteInfoDto"),
    },
    displayText: "Overview",
    icon: "binoculars",
    routingKey: "overview",
};

const configViewModel: RouteSetup<ResourceAndGroupId, StaticWebsiteConfig> = {
    content: {
        type: "object",
        actions: [
            {
                type: "edit",
                requestObject: ids => Use(APIService).resourceProviders._any_.webservices.staticwebsite._any_.config.get(ids.resourceGroupName, ids.resourceName),
                schema: OpenAPISchema("StaticWebsiteConfig"),
                updateResource: (ids, config) => Use(APIService).resourceProviders._any_.webservices.staticwebsite._any_.config.put(ids.resourceGroupName, ids.resourceName, config),
            }
        ],
        formTitle: _ => "Config",
        requestObject: ids => Use(APIService).resourceProviders._any_.webservices.staticwebsite._any_.config.get(ids.resourceGroupName, ids.resourceName),
        schema: OpenAPISchema("StaticWebsiteConfig"),
    },
    displayText: "Config",
    icon: "sliders",
    routingKey: "config",
};

const contentRouteSetup: RouteSetup<ResourceAndGroupId, { file: File }> = {
    content: {
        type: "create",
        call: (ids, data) => Use(APIService).resourceProviders._any_.webservices.staticwebsite._any_.post(ids.resourceGroupName, ids.resourceName, { file: data.file }),
        schema: {
            type: "object",
            additionalProperties: false,
            properties: {
                file: {
                    type: "string",
                    format: "binary"
                },
            },
            required: ["file"],
        }
    },
    displayText: "Content",
    icon: "archive",
    routingKey: "content",
};

export const staticWebsiteViewModel: RouteSetup<ResourceAndGroupId> = {
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
                    contentRouteSetup
                ]
            },
            BuildResourceGeneralPageGroupEntry(BuildResourceId),
        ],
        formTitle: ids => ids.resourceName,
    },
    displayText: "Static website",
    icon: "file-richtext",
    routingKey: `${resourceProviders.webServices.name}/${resourceProviders.webServices.staticWebsiteResourceType.name}/{resourceName}`
};