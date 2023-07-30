/**
 * OpenPrivateCloud
 * Copyright (C) 2023 Amir Czwink (amir130@hotmail.de)
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
import { MultiPageViewModel, ObjectViewModel } from "../../UI/ViewModel";
import { BuildCommonResourceActions, BuildResourceGeneralPageGroupEntry } from "../shared/resourcegeneral";
import { ListViewModel } from "../../UI/ListViewModel";
import { FirewallRule, VNetSettings } from "../../../dist/api";
import { ExtractDataFromResponseOrShowErrorMessageOnError } from "../../UI/ResponseHandler";

type ResourceAndGroupId = { resourceGroupName: string; resourceName: string };

function BuildResourceId(resourceGroupName: string, resourceName: string)
{
    return "/" + resourceGroupName + "/" + resourceProviders.networkServices.name + "/" + resourceProviders.networkServices.virtualNetworkResourceType.name + "/" + resourceName;
}

const settingsViewModel: ObjectViewModel<VNetSettings, ResourceAndGroupId> = {
    type: "object",
    actions: [],
    formTitle: _ => "Settings",
    requestObject: (service, ids) => service.resourceProviders._any_.networkservices.virtualnetwork._any_.settings.get(ids.resourceGroupName, ids.resourceName),
    schemaName: "VNetSettings"
};

function BuildFirewallViewModel(direction: "Inbound" | "Outbound")
{
    const firewallViewModel: ListViewModel<FirewallRule, ResourceAndGroupId> = {
        type: "list",
        actions: [
            {
                type: "create",
                createResource: (service, ids, rule) => service.resourceProviders._any_.networkservices.virtualnetwork._any_.firewall._any_.put(ids.resourceGroupName, ids.resourceName, direction, rule),
            }
        ],
        boundActions: [
            {
                type: "edit",
                schemaName: "FirewallRule",
                updateResource: async (service, ids, idx, rule) => {
                    const response = await service.resourceProviders._any_.networkservices.virtualnetwork._any_.firewall._any_.get(ids.resourceGroupName, ids.resourceName, direction);
                    const result = ExtractDataFromResponseOrShowErrorMessageOnError(response);
                    if(result.ok)
                    {
                        const ruleToDelete = result.value[idx];
                        await service.resourceProviders._any_.networkservices.virtualnetwork._any_.firewall._any_.delete(ids.resourceGroupName, ids.resourceName, direction, { priority: ruleToDelete.priority });
                        return service.resourceProviders._any_.networkservices.virtualnetwork._any_.firewall._any_.put(ids.resourceGroupName, ids.resourceName, direction, rule);
                    }

                    return response;
                },
            },
            {
                type: "delete",
                deleteResource: (service, ids, rule) => service.resourceProviders._any_.networkservices.virtualnetwork._any_.firewall._any_.delete(ids.resourceGroupName, ids.resourceName, direction, rule),
            }
        ],
        displayName: direction + " firewall rules",
        requestObjects: (service, ids) => service.resourceProviders._any_.networkservices.virtualnetwork._any_.firewall._any_.get(ids.resourceGroupName, ids.resourceName, direction),
        schemaName: "FirewallRule"
    };

    return firewallViewModel;
}

export const vnetViewModel: MultiPageViewModel<ResourceAndGroupId> = {
    actions: [
        ...BuildCommonResourceActions(BuildResourceId)
    ],
    entries: [
        {
            displayName: "",
            entries: [
                {
                    child: settingsViewModel,
                    displayName: "Settings",
                    key: "settings",
                },
                {
                    child: BuildFirewallViewModel("Inbound"),
                    displayName: "Inbound Firewall rules",
                    key: "inboundfw",
                    icon: {
                        type: "bootstrap",
                        name: "bricks"
                    }
                },
                {
                    child: BuildFirewallViewModel("Outbound"),
                    displayName: "Outbound Firewall rules",
                    key: "outboundfw",
                    icon: {
                        type: "bootstrap",
                        name: "bricks"
                    }
                },
            ]
        },
        BuildResourceGeneralPageGroupEntry(BuildResourceId),
    ],
    formTitle: ids => ids.resourceName,
    type: "multiPage"
};
