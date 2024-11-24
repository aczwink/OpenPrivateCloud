/**
 * OpenPrivateCloud
 * Copyright (C) 2024 Amir Czwink (amir130@hotmail.de)
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
import { ContainerInfo, DockerContainerLogDto, WAFConfig, WAFRuleMatch } from "../../../dist/api";
import { APIResponseHandler, RouteSetup } from "acfrontendex";
import { BuildCommonResourceActions, BuildResourceGeneralPageGroupEntry } from "../resources-shared/resource-general";
import { Use } from "acfrontend";
import { APIService } from "../../services/APIService";
import { OpenAPISchema } from "../../api-info";

type ResourceAndGroupId = { resourceGroupName: string; resourceName: string };

function BuildResourceId(resourceGroupName: string, resourceName: string)
{
    return "/" + resourceGroupName + "/" + resourceProviders.securityServices.name + "/" + resourceProviders.securityServices.wafResourceTypeName.name + "/" + resourceName;
}

const overviewViewModel: RouteSetup<ResourceAndGroupId, ContainerInfo> = {
    content: {
        type: "object",
        actions: [],
        formTitle: _ => "Overview",
        requestObject: ids => Use(APIService).resourceProviders._any_.securityservices.webapplicationfirewall._any_.info.get(ids.resourceGroupName, ids.resourceName),
        schema: OpenAPISchema("ContainerInfo"),
    },
    displayText: "Overview",
    icon: "binoculars",
    routingKey: "overview",
};

const ruleMatchesViewModel: RouteSetup<ResourceAndGroupId, WAFRuleMatch> = {
    content: {
        type: "list",
        actions: [],
        boundActions: [],
        requestObjects: ids => Use(APIService).resourceProviders._any_.securityservices.webapplicationfirewall._any_.matches.get(ids.resourceGroupName, ids.resourceName),
        schema: OpenAPISchema("WAFRuleMatch")
    },
    displayText: "Firewall log",
    icon: "journal-x",
    routingKey: "ruleMatches",
};

const logViewModel: RouteSetup<ResourceAndGroupId, DockerContainerLogDto> = {
    content: {
        type: "object",
        actions: [],
        formTitle: _ => "Logs",
        requestObject: ids => Use(APIService).resourceProviders._any_.securityservices.webapplicationfirewall._any_.log.get(ids.resourceGroupName, ids.resourceName),
        schema: OpenAPISchema("DockerContainerLogDto"),
    },
    displayText: "Service log",
    icon: "journal",
    routingKey: "logs",
};

const settingsViewModel: RouteSetup<ResourceAndGroupId, WAFConfig> = {
    content: {
        type: "object",
        actions: [
            {
                type: "edit",
                loadContext: async ids => {
                    const response = await Use(APIService).health.resource.get({ id: BuildResourceId(ids.resourceGroupName, ids.resourceName) });
                    const result = await Use(APIResponseHandler).ExtractDataFromResponseOrShowErrorMessageOnError(response);
                    if(result.ok)
                    {
                        return {
                            hostName: result.value.hostName
                        };
                    }
                    return {
                        hostName: ""
                    };
                },
                requestObject: ids => Use(APIService).resourceProviders._any_.securityservices.webapplicationfirewall._any_.settings.get(ids.resourceGroupName, ids.resourceName),
                schema: OpenAPISchema("WAFConfig"),
                updateResource: (ids, settings) => Use(APIService).resourceProviders._any_.securityservices.webapplicationfirewall._any_.settings.put(ids.resourceGroupName, ids.resourceName, settings),
            }
        ],
        formTitle: _ => "Settings",
        requestObject: ids => Use(APIService).resourceProviders._any_.securityservices.webapplicationfirewall._any_.settings.get(ids.resourceGroupName, ids.resourceName),
        schema: OpenAPISchema("WAFConfig"),
    },
    displayText: "Config",
    icon: "sliders",
    routingKey: "config",
};

export const wafViewModel: RouteSetup<ResourceAndGroupId> = {
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
                    ruleMatchesViewModel,
                    logViewModel,
                    settingsViewModel
                ]
            },
            BuildResourceGeneralPageGroupEntry(BuildResourceId),
        ],
        formTitle: ids => ids.resourceName,
    },
    displayText: "Web Application Firewall",
    icon: "fire",
    routingKey: `${resourceProviders.securityServices.name}/${resourceProviders.securityServices.wafResourceTypeName.name}/{resourceName}`
};
