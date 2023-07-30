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
import { API_EntryConfig, API_GatewaySettings, ContainerInfo } from "../../../dist/api";
import { ExtractDataFromResponseOrShowErrorMessageOnError } from "../../UI/ResponseHandler";
import { ListViewModel } from "../../UI/ListViewModel";

type ResourceAndGroupId = { resourceGroupName: string; resourceName: string };

function BuildResourceId(resourceGroupName: string, resourceName: string)
{
    return "/" + resourceGroupName + "/" + resourceProviders.webServices.name + "/" + resourceProviders.webServices.apiGatewayResourceType.name + "/" + resourceName;
}

const overviewViewModel: ObjectViewModel<ContainerInfo, ResourceAndGroupId>  = {
    type: "object",
    actions: [],
    formTitle: _ => "Overview",
    requestObject: (service, ids) => service.resourceProviders._any_.webservices.apigateway._any_.info.get(ids.resourceGroupName, ids.resourceName),
    schemaName: "ContainerInfo",
};

const apisViewModel: ListViewModel<API_EntryConfig, ResourceAndGroupId> = {
    type: "list",
    actions: [
        {
            type: "create",
            createResource: (service, ids, api) => service.resourceProviders._any_.webservices.apigateway._any_.apis.post(ids.resourceGroupName, ids.resourceName, api),
        }
    ],
    boundActions: [
        {
            type: "delete",
            deleteResource: (service, ids, api) => service.resourceProviders._any_.webservices.apigateway._any_.apis.delete(ids.resourceGroupName, ids.resourceName, api),
        }
    ],
    displayName: "APIs",
    requestObjects: (service, ids) => service.resourceProviders._any_.webservices.apigateway._any_.apis.get(ids.resourceGroupName, ids.resourceName),
    schemaName: "API_EntryConfig"
};

const settingsViewModel: ObjectViewModel<API_GatewaySettings, ResourceAndGroupId> = {
    type: "object",
    actions: [
        {
            type: "edit",
            propertiesSchemaName: "API_GatewaySettings",
            loadContext: async (service, ids) => {
                const response = await service.health.resource.get({ id: BuildResourceId(ids.resourceGroupName, ids.resourceName) });
                const result = ExtractDataFromResponseOrShowErrorMessageOnError(response);
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
            requestObject: (service, ids) => service.resourceProviders._any_.webservices.apigateway._any_.settings.get(ids.resourceGroupName, ids.resourceName),
            updateResource: (service, ids, settings) => service.resourceProviders._any_.webservices.apigateway._any_.settings.put(ids.resourceGroupName, ids.resourceName, settings),
        }
    ],
    formTitle: _ => "Settings",
    requestObject: (service, ids) => service.resourceProviders._any_.webservices.apigateway._any_.settings.get(ids.resourceGroupName, ids.resourceName),
    schemaName: "API_GatewaySettings"
};

export const apiGatewayViewModel: MultiPageViewModel<ResourceAndGroupId> = {
    actions: [
        ...BuildCommonResourceActions(BuildResourceId)
    ],
    entries: [
        {
            displayName: "",
            entries: [
                {
                    key: "overview",
                    displayName: "Overview",
                    child: overviewViewModel
                },
                {
                    key: "apis",
                    child: apisViewModel,
                    displayName: "APIs"
                },
                {
                    key: "serverSettings",
                    displayName: "Server settings",
                    child: settingsViewModel
                }
            ]
        },
        BuildResourceGeneralPageGroupEntry(BuildResourceId),
    ],
    formTitle: ids => ids.resourceName,
    type: "multiPage"
};
