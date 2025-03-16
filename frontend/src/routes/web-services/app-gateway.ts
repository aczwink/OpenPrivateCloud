/**
 * OpenPrivateCloud
 * Copyright (C) 2023-2025 Amir Czwink (amir130@hotmail.de)
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
import { API_GatewaySettingsDTO, AppGatewayRoutingRuleDTO, ContainerInfo, DockerContainerLogDto } from "../../../dist/api";
import { APIResponseHandler, RouteSetup } from "acfrontendex";
import { BuildCommonResourceActions, BuildResourceGeneralPageGroupEntry } from "../resources-shared/resource-general";
import { Use } from "acfrontend";
import { APIService } from "../../services/APIService";
import { OpenAPISchema } from "../../api-info";

type ResourceAndGroupId = { resourceGroupName: string; resourceName: string };

function BuildResourceId(resourceGroupName: string, resourceName: string)
{
    return "/" + resourceGroupName + "/" + resourceProviders.webServices.name + "/" + resourceProviders.webServices.appGatewayResourceType.name + "/" + resourceName;
}

const overviewViewModel: RouteSetup<ResourceAndGroupId, ContainerInfo> = {
    content: {
        type: "object",
        actions: [],
        formTitle: _ => "Overview",
        requestObject: ids => Use(APIService).resourceProviders._any_.webservices.appgateway._any_.info.get(ids.resourceGroupName, ids.resourceName),
        schema: OpenAPISchema("ContainerInfo")
    },
    displayText: "Overview",
    icon: "binoculars",
    routingKey: "overview",
};

const createRuleRoute: RouteSetup<ResourceAndGroupId, AppGatewayRoutingRuleDTO> = {
    content: {
        type: "create",
        call: (ids, api) => Use(APIService).resourceProviders._any_.webservices.appgateway._any_.rules.post(ids.resourceGroupName, ids.resourceName, api),
        schema: OpenAPISchema("AppGatewayRoutingRuleDTO"),
    },
    displayText: "Create rule",
    icon: "plus",
    routingKey: "create",
};

const rulesViewModel: RouteSetup<ResourceAndGroupId, AppGatewayRoutingRuleDTO> = {
    content: {
        type: "list",
        actions: [
            createRuleRoute
        ],
        boundActions: [
            {
                type: "edit",
                updateResource: (ids, newProps, oldProps) => Use(APIService).resourceProviders._any_.webservices.appgateway._any_.rules.put(ids.resourceGroupName, ids.resourceName, { oldFrontendDomainName: oldProps.frontendDomainName, newProps }),
                schema: OpenAPISchema("AppGatewayRoutingRuleDTO")
            },
            {
                type: "delete",
                deleteResource: (ids, api) => Use(APIService).resourceProviders._any_.webservices.appgateway._any_.rules.delete(ids.resourceGroupName, ids.resourceName, api),
            }
        ],
        requestObjects: ids => Use(APIService).resourceProviders._any_.webservices.appgateway._any_.rules.get(ids.resourceGroupName, ids.resourceName),
        schema: OpenAPISchema("AppGatewayRoutingRuleDTO")
    },
    displayText: "Routing rules",
    icon: "list",
    routingKey: "rules"
};

const settingsViewModel: RouteSetup<ResourceAndGroupId, API_GatewaySettingsDTO> = {
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
                requestObject: ids => Use(APIService).resourceProviders._any_.webservices.appgateway._any_.settings.get(ids.resourceGroupName, ids.resourceName),
                schema: OpenAPISchema("API_GatewaySettingsDTO"),
                updateResource: (ids, settings) => Use(APIService).resourceProviders._any_.webservices.appgateway._any_.settings.put(ids.resourceGroupName, ids.resourceName, settings),
            }
        ],
        formTitle: _ => "Settings",
        requestObject: ids => Use(APIService).resourceProviders._any_.webservices.appgateway._any_.settings.get(ids.resourceGroupName, ids.resourceName),
        schema: OpenAPISchema("API_GatewaySettingsDTO"),
    },
    displayText: "Server settings",
    icon: "sliders",
    routingKey: "serverSettings",
};

const logViewModel: RouteSetup<ResourceAndGroupId, DockerContainerLogDto> = {
    content: {
        type: "object",
        actions: [],
        formTitle: _ => "Logs",
        requestObject: async ids => Use(APIService).resourceProviders._any_.webservices.appgateway._any_.log.get(ids.resourceGroupName, ids.resourceName),
        schema: OpenAPISchema("DockerContainerLogDto"),
    },
    displayText: "Live log",
    icon: "journal",
    routingKey: "logs",
};

export const appGatewayViewModel: RouteSetup<ResourceAndGroupId> = {
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
                    rulesViewModel,
                    settingsViewModel,
                    logViewModel
                ]
            },
            BuildResourceGeneralPageGroupEntry(BuildResourceId),
        ],
        formTitle: ids => ids.resourceName,
    },
    displayText: "Application Gateway",
    icon: "sign-turn-right",
    routingKey: `${resourceProviders.webServices.name}/${resourceProviders.webServices.appGatewayResourceType.name}/{resourceName}`
};
