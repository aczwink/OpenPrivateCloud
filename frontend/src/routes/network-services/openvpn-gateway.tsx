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

import { FileDownloadService, JSX_CreateElement, RootInjector, Use } from "acfrontend";
import { resourceProviders } from "openprivatecloud-common";
import { OpenVPNGatewayClient, OpenVPNGatewayConnectedClientEntry, OpenVPNGatewayExternalConfig, OpenVPNGatewayInfo } from "../../../dist/api";
import { APIResponseHandler, RouteSetup } from "acfrontendex";
import { APIService } from "../../services/APIService";
import { BuildResourceGeneralPageGroupEntry } from "../resources-shared/resource-general";
import { OpenAPISchema } from "../../api-info";
import { DataExplorerComponent } from "../../components/data-explorer/DataExplorerComponent";

type ResourceAndGroupId = { resourceGroupName: string; resourceName: string };

function BuildResourceId(resourceGroupName: string, resourceName: string)
{
    return "/" + resourceGroupName + "/" + resourceProviders.networkServices.name + "/" + resourceProviders.networkServices.openVPNGatewayResourceType.name + "/" + resourceName;
}

const overviewViewModel: RouteSetup<ResourceAndGroupId, OpenVPNGatewayInfo> = {
    content: {
        type: "object",
        actions: [],
        formTitle: _ => "Overview",
        requestObject: ids => Use(APIService).resourceProviders._any_.networkservices.openvpngateway._any_.info.get(ids.resourceGroupName, ids.resourceName),
        schema: OpenAPISchema("OpenVPNGatewayInfo"),        
    },
    displayText: "Overview",
    icon: "binoculars",
    routingKey: "overview",
};

const connectionsViewModel: RouteSetup<ResourceAndGroupId, OpenVPNGatewayConnectedClientEntry> = {
    content: {
        type: "list",
        requestObjects: ids => Use(APIService).resourceProviders._any_.networkservices.openvpngateway._any_.connections.get(ids.resourceGroupName, ids.resourceName),
        schema: OpenAPISchema("OpenVPNGatewayConnectedClientEntry"),
    },
    displayText: "Connections",
    icon: "link",
    routingKey: "connections",
};

const clientsViewModel: RouteSetup<ResourceAndGroupId, OpenVPNGatewayClient> = {
    content: {
        type: "list",
        boundActions: [
            {
                type: "custom",
                action: async (ids, client) => {
                    const response = await Use(APIService).resourceProviders._any_.networkservices.openvpngateway._any_.clientconfig.get(ids.resourceGroupName, ids.resourceName, { clientName: client.name });
                    const result = await Use(APIResponseHandler).ExtractDataFromResponseOrShowErrorMessageOnError(response);
                    if(result.ok)
                    {
                        const fds = RootInjector.Resolve(FileDownloadService);
                        fds.DownloadBlobAsFile(new Blob([result.value]), "client.ovpn");
                    }
                },
                icon: "download"
            }
        ],
        requestObjects: ids => Use(APIService).resourceProviders._any_.networkservices.openvpngateway._any_.clients.get(ids.resourceGroupName, ids.resourceName),
        schema: OpenAPISchema("OpenVPNGatewayClient")
    },
    displayText: "Clients",
    icon: "person-square",
    routingKey: "clients",
};

const configViewModel: RouteSetup<ResourceAndGroupId, OpenVPNGatewayExternalConfig> = {
    content: {
        type: "object",
        actions: [
            {
                type: "edit",
                requestObject: ids => Use(APIService).resourceProviders._any_.networkservices.openvpngateway._any_.config.get(ids.resourceGroupName, ids.resourceName),
                schema: OpenAPISchema("OpenVPNGatewayExternalConfig"),
                updateResource: (ids, props) => Use(APIService).resourceProviders._any_.networkservices.openvpngateway._any_.config.put(ids.resourceGroupName, ids.resourceName, props),
            }
        ],
        formTitle: _ => "Server configuration",
        requestObject: ids => Use(APIService).resourceProviders._any_.networkservices.openvpngateway._any_.config.get(ids.resourceGroupName, ids.resourceName),
        schema: OpenAPISchema("OpenVPNGatewayExternalConfig")
    },
    displayText: "Config",
    icon: "sliders",
    routingKey: "config",
};

export const openVPNGatewayViewModel: RouteSetup<ResourceAndGroupId> = {
    content: {
        type: "multiPage",
        actions: [
            {
                type: "delete",
                deleteResource: ids => Use(APIService).resourceGroups._any_.resources.delete(ids.resourceGroupName, { resourceId: BuildResourceId(ids.resourceGroupName, ids.resourceName) })
            }
        ],
        entries: [
            {
                displayName: "",
                entries: [
                    overviewViewModel,
                    connectionsViewModel,
                    {
                        content: {
                            type: "element",
                            element: ids => {
                                const query = `
                                source resourceGroups.${ids.resourceGroupName}.${BuildResourceId(ids.resourceGroupName, ids.resourceName)}
                                `;
    
                                return <DataExplorerComponent query={query} />;
                            }
                        },
                        displayText: "Logs",
                        icon: "journal",
                        routingKey: "logs",
                    },
                    clientsViewModel,
                    configViewModel
                ],
            },
            BuildResourceGeneralPageGroupEntry(BuildResourceId),
        ],
        formTitle: ids => ids.resourceName,
    },
    displayText: "OpenVPN Gateway",
    icon: "shield-lock",
    routingKey: `${resourceProviders.networkServices.name}/${resourceProviders.networkServices.openVPNGatewayResourceType.name}/{resourceName}`,
};