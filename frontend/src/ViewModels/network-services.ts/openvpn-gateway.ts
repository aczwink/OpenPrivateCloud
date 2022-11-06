/**
 * OpenPrivateCloud
 * Copyright (C) 2019-2022 Amir Czwink (amir130@hotmail.de)
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
import { OpenVPNGatewayClient, OpenVPNGatewayInfo } from "../../../dist/api";
import { ListViewModel } from "../../UI/ListViewModel";
import { MultiPageViewModel, ObjectViewModel } from "../../UI/ViewModel";

type InstanceId = { instanceName: string };

function BuildFullInstanceName(instanceName: string)
{
    return "/" + resourceProviders.networkServices.name + "/" + resourceProviders.networkServices.openVPNGatewayResourceType.name + "/" + instanceName;
}

const overviewViewModel: ObjectViewModel<OpenVPNGatewayInfo, InstanceId>  = {
    type: "object",
    actions: [
    ],
    formTitle: _ => "Overview",
    requestObject: (service, ids) => service.resourceProviders.networkservices.openvpngateway._any_.info.get(ids.instanceName),
    schemaName: "OpenVPNGatewayInfo",
};

const clientsViewModel: ListViewModel<OpenVPNGatewayClient, InstanceId> = {
    type: "list",
    actions: [
        {
            type: "create",
            createResource: (service, ids, client) => service.resourceProviders.networkservices.openvpngateway._any_.clients.post(ids.instanceName, client)
        }
    ],
    boundActions: [
        {
            type: "delete",
            deleteResource: (service, ids, client) => service.resourceProviders.networkservices.openvpngateway._any_.clients.delete(ids.instanceName, client)
        }
    ],
    displayName: "Clients",
    requestObjects: (service, ids) => service.resourceProviders.networkservices.openvpngateway._any_.clients.get(ids.instanceName),
    schemaName: "OpenVPNGatewayClient",
};

export const openVPNGatewayViewModel: MultiPageViewModel<InstanceId> = {
    actions: [
        {
            type: "delete",
            deleteResource: (service, ids) => service.instances.delete({ fullInstanceName: BuildFullInstanceName(ids.instanceName) })
        }
    ],
    entries: [
        {
            key: "overview",
            displayName: "Overview",
            child: overviewViewModel,
        },
        {
            key: "clients",
            displayName: "Clients",
            child: clientsViewModel
        }
    ],
    formTitle: ids => ids.instanceName,
    type: "multiPage"
};