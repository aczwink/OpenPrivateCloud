/**
 * OpenPrivateCloud
 * Copyright (C) 2019-2023 Amir Czwink (amir130@hotmail.de)
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

import { FileDownloadService, RootInjector } from "acfrontend";
import { resourceProviders } from "openprivatecloud-common";
import { OpenVPNGatewayClient, OpenVPNGatewayConnectedClientEntry, OpenVPNGatewayExternalConfig, OpenVPNGatewayInfo, OpenVPNGatewayLogEntry } from "../../../dist/api";
import { ListViewModel } from "../../UI/ListViewModel";
import { ExtractDataFromResponseOrShowErrorMessageOnError } from "../../UI/ResponseHandler";
import { MultiPageViewModel, ObjectViewModel } from "../../UI/ViewModel";

type ResourceAndGroupId = { resourceGroupName: string; resourceName: string };

function BuildResourceId(resourceGroupName: string, resourceName: string)
{
    return "/" + resourceGroupName + "/" + resourceProviders.networkServices.name + "/" + resourceProviders.networkServices.openVPNGatewayResourceType.name + "/" + resourceName;
}

const overviewViewModel: ObjectViewModel<OpenVPNGatewayInfo, ResourceAndGroupId>  = {
    type: "object",
    actions: [
    ],
    formTitle: _ => "Overview",
    requestObject: (service, ids) => service.resourceProviders._any_.networkservices.openvpngateway._any_.info.get(ids.resourceGroupName, ids.resourceName),
    schemaName: "OpenVPNGatewayInfo",
};

const connectionsViewModel: ListViewModel<OpenVPNGatewayConnectedClientEntry, ResourceAndGroupId> = {
    type: "list",
    actions: [],
    boundActions: [],
    displayName: "Connections",
    requestObjects: (service, ids) => service.resourceProviders._any_.networkservices.openvpngateway._any_.connections.get(ids.resourceGroupName, ids.resourceName),
    schemaName: "OpenVPNGatewayConnectedClientEntry"
};

const logsViewModel: ListViewModel<OpenVPNGatewayLogEntry, ResourceAndGroupId> = {
    type: "list",
    actions: [],
    boundActions: [],
    displayName: "Logs",
    requestObjects: (service, ids) => service.resourceProviders._any_.networkservices.openvpngateway._any_.logs.get(ids.resourceGroupName, ids.resourceName),
    schemaName: "OpenVPNGatewayLogEntry"
};

const clientsViewModel: ListViewModel<OpenVPNGatewayClient, ResourceAndGroupId> = {
    type: "list",
    actions: [
        {
            type: "create",
            createResource: (service, ids, client) => service.resourceProviders._any_.networkservices.openvpngateway._any_.clients.post(ids.resourceGroupName, ids.resourceName, client)
        }
    ],
    boundActions: [
        {
            type: "custom",
            action: async (service, ids, client) => {
                const response = await service.resourceProviders._any_.networkservices.openvpngateway._any_.clientconfig.get(ids.resourceGroupName, ids.resourceName, { clientName: client.name });
                const result = ExtractDataFromResponseOrShowErrorMessageOnError(response);
                if(result.ok)
                {
                    const fds = RootInjector.Resolve(FileDownloadService);
                    fds.DownloadBlobAsFile(new Blob([result.value]), "client.ovpn");
                }
            },
            matIcon: "download"
        },
        {
            type: "delete",
            deleteResource: (service, ids, client) => service.resourceProviders._any_.networkservices.openvpngateway._any_.clients.delete(ids.resourceGroupName, ids.resourceName, client)
        },
    ],
    displayName: "Clients",
    requestObjects: (service, ids) => service.resourceProviders._any_.networkservices.openvpngateway._any_.clients.get(ids.resourceGroupName, ids.resourceName),
    schemaName: "OpenVPNGatewayClient",
};

const configViewModel: ObjectViewModel<OpenVPNGatewayExternalConfig, ResourceAndGroupId> = {
    type: "object",
    actions: [
        {
            type: "edit",
            propertiesSchemaName: "OpenVPNGatewayExternalConfig",
            requestObject: (service, ids) => service.resourceProviders._any_.networkservices.openvpngateway._any_.config.get(ids.resourceGroupName, ids.resourceName),
            updateResource: (service, ids, props) => service.resourceProviders._any_.networkservices.openvpngateway._any_.config.put(ids.resourceGroupName, ids.resourceName, props),
        }
    ],
    formTitle: _ => "Server configuration",
    requestObject: (service, ids) => service.resourceProviders._any_.networkservices.openvpngateway._any_.config.get(ids.resourceGroupName, ids.resourceName),
    schemaName: "OpenVPNGatewayExternalConfig"
};

export const openVPNGatewayViewModel: MultiPageViewModel<ResourceAndGroupId> = {
    actions: [
        {
            type: "delete",
            deleteResource: (service, ids) => service.resourceGroups._any_.resources.delete(ids.resourceGroupName, { resourceId: BuildResourceId(ids.resourceGroupName, ids.resourceName) })
        }
    ],
    entries: [
        {
            displayName: "",
            entries: [
                {
                    key: "overview",
                    displayName: "Overview",
                    child: overviewViewModel,
                },
                {
                    child: connectionsViewModel,
                    displayName: "Connections",
                    key: "connections",
                },
                {
                    child: logsViewModel,
                    displayName: "Logs",
                    key: "logs",
                },
                {
                    key: "clients",
                    displayName: "Clients",
                    child: clientsViewModel
                },
                {
                    key: "config",
                    displayName: "Config",
                    child: configViewModel,
                },
            ]
        }
    ],
    formTitle: ids => ids.resourceName,
    type: "multiPage"
};