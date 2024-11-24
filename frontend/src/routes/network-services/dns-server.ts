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
import { DNS_Record, DNS_ServerSettings, DNS_ZoneDTO } from "../../../dist/api";
import { RouteSetup } from "acfrontendex";
import { BuildCommonResourceActions, BuildResourceGeneralPageGroupEntry } from "../resources-shared/resource-general";
import { Use } from "acfrontend";
import { APIService } from "../../services/APIService";
import { OpenAPISchema } from "../../api-info";

type ResourceAndGroupId = { resourceGroupName: string; resourceName: string };
type ZoneId = { zoneName: string } & ResourceAndGroupId;

function BuildResourceId(resourceGroupName: string, resourceName: string)
{
    return "/" + resourceGroupName + "/" + resourceProviders.networkServices.name + "/" + resourceProviders.networkServices.dnsServerResourceType.name + "/" + resourceName;
}

const createRecordRoute: RouteSetup<ZoneId, DNS_Record> = {
    content: {
        type: "create",
        call: (ids, record) => Use(APIService).resourceProviders._any_.networkservices.dnsserver._any_.zones._any_.records.post(ids.resourceGroupName, ids.resourceName, ids.zoneName, record),
        schema: OpenAPISchema("DNS_Record"),
    },
    displayText: "Create record",
    icon: "plus",
    routingKey: "create",
};

const recordsViewModel: RouteSetup<ZoneId, DNS_Record> = {
    content: {
        type: "list",
        actions: [
            createRecordRoute
        ],
        boundActions: [
            {
                type: "edit",
                schema: OpenAPISchema("DNS_Record"),
                updateResource: (ids, newProperties, oldProperties) => Use(APIService).resourceProviders._any_.networkservices.dnsserver._any_.zones._any_.records.put(ids.resourceGroupName, ids.resourceName, ids.zoneName, {
                    existingRecord: oldProperties,
                    newRecord: newProperties
                }),
            },
            {
                type: "delete",
                deleteResource: (ids, record) => Use(APIService).resourceProviders._any_.networkservices.dnsserver._any_.zones._any_.records.delete(ids.resourceGroupName, ids.resourceName, ids.zoneName, record)
            }
        ],
        requestObjects: ids => Use(APIService).resourceProviders._any_.networkservices.dnsserver._any_.zones._any_.records.get(ids.resourceGroupName, ids.resourceName, ids.zoneName),
        schema: OpenAPISchema("DNS_Record"),
    },
    displayText: "Record set",
    icon: "card-list",
    routingKey: "records",
};

const zoneViewModel: RouteSetup<ZoneId> = {
    content: {
        type: "multiPage",
        actions: [
            {
                type: "delete",
                deleteResource: ids => Use(APIService).resourceProviders._any_.networkservices.dnsserver._any_.zones._any_.delete(ids.resourceGroupName, ids.resourceName, ids.zoneName)
            }
        ],
        entries: [
            {
                displayName: "",
                entries: [
                    recordsViewModel
                ]
            }
        ],
        formTitle: ids => ids.zoneName,
    },
    displayText: "Zone",
    icon: "map",
    routingKey: "{zoneName}",
};

const createZoneRoute: RouteSetup<ResourceAndGroupId, DNS_ZoneDTO> = {
    content: {
        type: "create",
        call: (ids, zone) => Use(APIService).resourceProviders._any_.networkservices.dnsserver._any_.zones.post(ids.resourceGroupName, ids.resourceName, zone),
        schema: OpenAPISchema("DNS_ZoneDTO"),
    },
    displayText: "Create Zone",
    icon: "plus",
    routingKey: "create",
};

const zonesViewModel: RouteSetup<ResourceAndGroupId, DNS_ZoneDTO> = {
    content: {
        type: "collection",
        actions: [
            createZoneRoute
        ],
        child: zoneViewModel,
        id: "name",
        requestObjects: ids => Use(APIService).resourceProviders._any_.networkservices.dnsserver._any_.zones.get(ids.resourceGroupName, ids.resourceName),
        schema: OpenAPISchema("DNS_ZoneDTO")
    },
    displayText: "Zones",
    icon: "map",
    routingKey: "zones",
};

const serverSettingsViewModel: RouteSetup<ResourceAndGroupId, DNS_ServerSettings> = {
    content: {
        type: "object",
        actions: [
            {
                type: "edit",
                requestObject: ids => Use(APIService).resourceProviders._any_.networkservices.dnsserver._any_.serverSettings.get(ids.resourceGroupName, ids.resourceName),
                schema: OpenAPISchema("DNS_ServerSettings"),
                updateResource: (ids, settings) => Use(APIService).resourceProviders._any_.networkservices.dnsserver._any_.serverSettings.put(ids.resourceGroupName, ids.resourceName, settings),
            }
        ],
        formTitle: _ => "Server settings",
        requestObject: ids => Use(APIService).resourceProviders._any_.networkservices.dnsserver._any_.serverSettings.get(ids.resourceGroupName, ids.resourceName),
        schema: OpenAPISchema("DNS_ServerSettings"),
    },
    displayText: "Server settings",
    icon: "sliders",
    routingKey: "serverSettings",
};

export const dnsServerViewModel: RouteSetup<ResourceAndGroupId> = {
    content: {
        type: "multiPage",
        actions: [
            ...BuildCommonResourceActions(BuildResourceId)
        ],
        entries: [
            {
                displayName: "",
                entries: [
                    zonesViewModel,
                    serverSettingsViewModel
                ]
            },
            BuildResourceGeneralPageGroupEntry(BuildResourceId),
        ],
        formTitle: ids => ids.resourceName,
    },
    displayText: "DNS server",
    icon: "signpost-split",
    routingKey: `${resourceProviders.networkServices.name}/${resourceProviders.networkServices.dnsServerResourceType.name}/{resourceName}`
};
