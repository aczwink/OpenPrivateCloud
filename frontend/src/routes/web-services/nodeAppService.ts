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
import { NodeAppServiceConfigDTO, NodeAppServiceInfoDto, NodeAppServiceStatus } from "../../../dist/api";
import { RouteSetup } from "acfrontendex";
import { BuildCommonResourceActions, BuildResourceGeneralPageGroupEntry } from "../resources-shared/resource-general";
import { Use } from "acfrontend";
import { APIService } from "../../services/APIService";
import { OpenAPISchema } from "../../api-info";
import { UploadNodeAppServieContentComponent } from "../../components/node-app-service/UploadNodeAppServieContentComponent";

type ResourceAndGroupId = { resourceGroupName: string; resourceName: string };

function BuildResourceId(resourceGroupName: string, resourceName: string)
{
    return "/" + resourceGroupName + "/" + resourceProviders.webServices.name + "/" + resourceProviders.webServices.nodeAppServiceResourceType.name + "/" + resourceName;
}

const overviewViewModel: RouteSetup<ResourceAndGroupId, NodeAppServiceInfoDto> = {
    content: {
        type: "object",
        actions: [
            {
                type: "activate",
                execute: ids => Use(APIService).resourceProviders._any_.webservices.nodeappservice._any_.startStop.post(ids.resourceGroupName, ids.resourceName, { action: "start" }),
                icon: "play",
                title: "Start"
            },
            {
                type: "activate",
                execute: ids => Use(APIService).resourceProviders._any_.webservices.nodeappservice._any_.startStop.post(ids.resourceGroupName, ids.resourceName, { action: "stop" }),
                icon: "power",
                title: "Stop"
            },
        ],
        formTitle: _ => "Overview",
        requestObject: ids => Use(APIService).resourceProviders._any_.webservices.nodeappservice._any_.info.get(ids.resourceGroupName, ids.resourceName),
        schema: OpenAPISchema("NodeAppServiceInfoDto"),
    },
    displayText: "Overview",
    icon: "binoculars",
    routingKey: "overview",
};


const statusViewModel: RouteSetup<ResourceAndGroupId, NodeAppServiceStatus> = {
    content: {
        type: "object",
        actions: [],
        formTitle: _ => "Status",
        requestObject: ids => Use(APIService).resourceProviders._any_.webservices.nodeappservice._any_.status.get(ids.resourceGroupName, ids.resourceName),
        schema: OpenAPISchema("NodeAppServiceStatus"),
    },
    displayText: "Status",
    icon: "clipboard-pulse",
    routingKey: "status",
};


const configViewModel: RouteSetup<ResourceAndGroupId, NodeAppServiceConfigDTO> = {
    content: {
        type: "object",
        actions: [
            {
                type: "edit",
                requestObject: ids => Use(APIService).resourceProviders._any_.webservices.nodeappservice._any_.config.get(ids.resourceGroupName, ids.resourceName),
                schema: OpenAPISchema("NodeAppServiceConfigDTO"),
                updateResource: (ids, newValue) => Use(APIService).resourceProviders._any_.webservices.nodeappservice._any_.config.put(ids.resourceGroupName, ids.resourceName, newValue)
            }
        ],
        formTitle: _ => "Configuration",
        requestObject: ids => Use(APIService).resourceProviders._any_.webservices.nodeappservice._any_.config.get(ids.resourceGroupName, ids.resourceName),
        schema: OpenAPISchema("NodeAppServiceConfigDTO"),
    },
    displayText: "Config",
    icon: "sliders",
    routingKey: "config",
};

export const nodeAppServiceViewodel: RouteSetup<ResourceAndGroupId> = {
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
                    statusViewModel,
                    configViewModel,
                    {
                        content: {
                            type: "component",
                            component: UploadNodeAppServieContentComponent
                        },
                        displayText: "Content",
                        icon: "archive",
                        routingKey: "content",
                    }
                ]
            },
            BuildResourceGeneralPageGroupEntry(BuildResourceId)
        ],
        formTitle: ids => ids.resourceName,
    },
    displayText: "Node App service",
    icon: "app",
    routingKey: `${resourceProviders.webServices.name}/${resourceProviders.webServices.nodeAppServiceResourceType.name}/{resourceName}`
};