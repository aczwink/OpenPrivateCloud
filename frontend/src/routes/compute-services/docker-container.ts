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
import { ContainerAppServiceConfigDTO, DockerContainerInfo, DockerContainerLogDto } from "../../../dist/api";
import { APIResponseHandler, RouteSetup } from "acfrontendex";
import { BuildCommonResourceActions, BuildResourceGeneralPageGroupEntry } from "../resources-shared/resource-general";
import { Use } from "acfrontend";
import { APIService } from "../../services/APIService";
import { OpenAPISchema } from "../../api-info";

type ResourceAndGroupId = { resourceGroupName: string; resourceName: string };

function BuildResourceId(resourceGroupName: string, resourceName: string)
{
    return "/" + resourceGroupName + "/" + resourceProviders.computeServices.name + "/" + resourceProviders.computeServices.dockerContainerResourceType.name + "/" + resourceName;
}

const overviewViewModel: RouteSetup<ResourceAndGroupId, DockerContainerInfo> = {
    content: {
        type: "object",
        actions: [
            {
                type: "activate",
                execute: ids => Use(APIService).resourceProviders._any_.computeservices.dockercontainer._any_.post(ids.resourceGroupName, ids.resourceName, { action: "start"}),
                icon: "play",
                title: "Start"
            },
            {
                type: "activate",
                execute: ids => Use(APIService).resourceProviders._any_.computeservices.dockercontainer._any_.post(ids.resourceGroupName, ids.resourceName, { action: "shutdown"}),
                icon: "power",
                title: "Shutdown"
            },
            {
                type: "activate",
                execute: ids => Use(APIService).resourceProviders._any_.computeservices.dockercontainer._any_.update.post(ids.resourceGroupName, ids.resourceName),
                icon: "arrow-clockwise",
                title: "Update"
            }
        ],
        formTitle: _ => "Overview",
        requestObject: ids => Use(APIService).resourceProviders._any_.computeservices.dockercontainer._any_.info.get(ids.resourceGroupName, ids.resourceName),
        schema: OpenAPISchema("DockerContainerInfo")
    },
    displayText: "Overview",
    icon: "binoculars",
    routingKey: "overview",
};

const configViewModel: RouteSetup<ResourceAndGroupId, ContainerAppServiceConfigDTO> = {
    content: {
        type: "object",
        actions: [
            {
                type: "edit",
                loadContext: async ids => {
                    const response = await Use(APIService).resourceProviders._any_.computeservices.dockercontainer._any_.info.get(ids.resourceGroupName, ids.resourceName);
                    const result = await Use(APIResponseHandler).ExtractDataFromResponseOrShowErrorMessageOnError(response);
                    if(result.ok)
                        return result.value;
                    return {
                        hostName: ""
                    };
                },
                requestObject: ids => Use(APIService).resourceProviders._any_.computeservices.dockercontainer._any_.config.get(ids.resourceGroupName, ids.resourceName),
                schema: OpenAPISchema("ContainerAppServiceConfigDTO"),
                updateResource: (ids, newValue) => Use(APIService).resourceProviders._any_.computeservices.dockercontainer._any_.config.put(ids.resourceGroupName, ids.resourceName, newValue)
            }
        ],
        formTitle: _ => "Container configuration",
        requestObject: ids => Use(APIService).resourceProviders._any_.computeservices.dockercontainer._any_.config.get(ids.resourceGroupName, ids.resourceName),
        schema: OpenAPISchema("ContainerAppServiceConfigDTO"),
    },
    displayText: "Config",
    icon: "sliders",
    routingKey: "config",
};

const logViewModel: RouteSetup<ResourceAndGroupId, DockerContainerLogDto> = {
    content: {
        type: "object",
        actions: [],
        formTitle: _ => "Container log",
        requestObject: ids => Use(APIService).resourceProviders._any_.computeservices.dockercontainer._any_.log.get(ids.resourceGroupName, ids.resourceName),
        schema: OpenAPISchema("DockerContainerLogDto"),
    },
    displayText: "Live log",
    icon: "journal",
    routingKey: "logs",
};

export const dockerContainerViewModel: RouteSetup<ResourceAndGroupId> = {
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
                    configViewModel,
                    logViewModel
                ]
            },
            BuildResourceGeneralPageGroupEntry(BuildResourceId),
        ],
        formTitle: ids => ids.resourceName,
    },
    displayText: "Docker Container",
    icon: "box-seam-fill",
    routingKey: `${resourceProviders.computeServices.name}/${resourceProviders.computeServices.dockerContainerResourceType.name}/{resourceName}`
};