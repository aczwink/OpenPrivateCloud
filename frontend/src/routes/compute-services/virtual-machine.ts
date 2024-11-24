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
import { VMInfo } from "../../../dist/api";
import { RouteSetup } from "acfrontendex";
import { BuildCommonResourceActions, BuildResourceGeneralPageGroupEntry } from "../resources-shared/resource-general";
import { Use } from "acfrontend";
import { APIService } from "../../services/APIService";
import { OpenAPISchema } from "../../api-info";

type ResourceAndGroupId = { resourceGroupName: string; resourceName: string };

function BuildResourceId(resourceGroupName: string, resourceName: string)
{
    return "/" + resourceGroupName + "/" + resourceProviders.computeServices.name + "/" + resourceProviders.computeServices.virtualMachineResourceType.name + "/" + resourceName;
}

const overviewViewModel: RouteSetup<ResourceAndGroupId, VMInfo> = {
    content: {
        type: "object",
        actions: [
            {
                type: "activate",
                execute: ids => Use(APIService).resourceProviders._any_.computeservices.virtualmachine._any_.post(ids.resourceGroupName, ids.resourceName, { action: "start"}),
                icon: "play",
                title: "Start"
            },
            {
                type: "activate",
                execute: ids => Use(APIService).resourceProviders._any_.computeservices.virtualmachine._any_.post(ids.resourceGroupName, ids.resourceName, { action: "shutdown"}),
                icon: "power",
                title: "Shutdown"
            },
            {
                type: "activate",
                execute: ids => Use(APIService).resourceProviders._any_.computeservices.virtualmachine._any_.post(ids.resourceGroupName, ids.resourceName, { action: "destroy"}),
                icon: "radioactive",
                title: "Force shutdown"
            }
        ],
        formTitle: _ => "Overview",
        requestObject: ids => Use(APIService).resourceProviders._any_.computeservices.virtualmachine._any_.info.get(ids.resourceGroupName, ids.resourceName),
        schema: OpenAPISchema("VMInfo")
    },
    displayText: "Overview",
    icon: "binoculars",
    routingKey: "overview",
};

export const virtualMachineViewModel: RouteSetup<ResourceAndGroupId> = {
    content: {
        type: "multiPage",
        actions: [
            ...BuildCommonResourceActions(BuildResourceId),
        ],
        entries: [
            {
                displayName: "",
                entries: [
                    overviewViewModel
                ]
            },
            BuildResourceGeneralPageGroupEntry(BuildResourceId),
        ],
        formTitle: ids => ids.resourceName,
    },
    displayText: "Virtual machine",
    icon: "pc-display",
    routingKey: `${resourceProviders.computeServices.name}/${resourceProviders.computeServices.virtualMachineResourceType.name}/{resourceName}`
};