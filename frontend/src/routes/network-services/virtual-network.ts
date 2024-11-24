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
import { FirewallRule, VNetInfoDTO } from "../../../dist/api";
import { RouteSetup } from "acfrontendex";
import { BuildCommonResourceActions, BuildResourceGeneralPageGroupEntry } from "../resources-shared/resource-general";
import { Use } from "acfrontend";
import { APIService } from "../../services/APIService";
import { OpenAPISchema } from "../../api-info";

type ResourceAndGroupId = { resourceGroupName: string; resourceName: string };

function BuildResourceId(resourceGroupName: string, resourceName: string)
{
    return "/" + resourceGroupName + "/" + resourceProviders.networkServices.name + "/" + resourceProviders.networkServices.virtualNetworkResourceType.name + "/" + resourceName;
}

const settingsViewModel: RouteSetup<ResourceAndGroupId, VNetInfoDTO> = {
    content: {
        type: "object",
        actions: [],
        formTitle: _ => "Settings",
        requestObject: ids => Use(APIService).resourceProviders._any_.networkservices.virtualnetwork._any_.info.get(ids.resourceGroupName, ids.resourceName),
        schema: OpenAPISchema("VNetInfoDTO")
    },
    displayText: "Settings",
    icon: "sliders",
    routingKey: "settings",
};

function BuildFirewallViewModel(direction: "Inbound" | "Outbound")
{
    const createRuleRoute: RouteSetup<ResourceAndGroupId, FirewallRule> = {
        content: {
            type: "create",
            call: (ids, rule) => Use(APIService).resourceProviders._any_.networkservices.virtualnetwork._any_.firewall._any_.put(ids.resourceGroupName, ids.resourceName, direction, rule),
            schema: OpenAPISchema("FirewallRule"),
        },
        displayText: "Create rule",
        icon: "plus",
        routingKey: "create",
    };

    const firewallViewModel: RouteSetup<ResourceAndGroupId, FirewallRule> = {
        content: {
            type: "list",
            actions: [
                createRuleRoute
            ],
            boundActions: [
                {
                    type: "edit",
                    schema: OpenAPISchema("FirewallRule"),
                    updateResource: async (ids, rule, originalRule) => {                    
                        await Use(APIService).resourceProviders._any_.networkservices.virtualnetwork._any_.firewall._any_.delete(ids.resourceGroupName, ids.resourceName, direction, { priority: originalRule.priority });
                        return Use(APIService).resourceProviders._any_.networkservices.virtualnetwork._any_.firewall._any_.put(ids.resourceGroupName, ids.resourceName, direction, rule);
                    },
                },
                {
                    type: "delete",
                    deleteResource: (ids, rule) => Use(APIService).resourceProviders._any_.networkservices.virtualnetwork._any_.firewall._any_.delete(ids.resourceGroupName, ids.resourceName, direction, rule),
                }
            ],
            requestObjects: ids => Use(APIService).resourceProviders._any_.networkservices.virtualnetwork._any_.firewall._any_.get(ids.resourceGroupName, ids.resourceName, direction),
            schema: OpenAPISchema("FirewallRule"),
        },
        displayText: direction + " firewall rules",
        icon: "bricks",
        routingKey: direction.toLowerCase() + "fw",
    };

    return firewallViewModel;
}

export const vnetViewModel: RouteSetup<ResourceAndGroupId> = {
    content: {
        type: "multiPage",
        actions: [
            ...BuildCommonResourceActions(BuildResourceId)
        ],
        entries: [
            {
                displayName: "",
                entries: [
                    settingsViewModel,
                    BuildFirewallViewModel("Inbound"),
                    BuildFirewallViewModel("Outbound")
                ]
            },
            BuildResourceGeneralPageGroupEntry(BuildResourceId),
        ],
        formTitle: ids => ids.resourceName,
    },
    displayText: "Virtual network",
    icon: "ethernet",
    routingKey: `${resourceProviders.networkServices.name}/${resourceProviders.networkServices.virtualNetworkResourceType.name}/{resourceName}`
};
