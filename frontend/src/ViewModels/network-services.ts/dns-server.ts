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
import { CollectionViewModel, MultiPageViewModel } from "../../UI/ViewModel";
import { BuildCommonResourceActions, BuildResourceGeneralPageGroupEntry } from "../shared/resourcegeneral";
import { DNS_Record, DNS_ZoneDTO } from "../../../dist/api";
import { ListViewModel } from "../../UI/ListViewModel";

type ResourceAndGroupId = { resourceGroupName: string; resourceName: string };
type ZoneId = { zoneName: string } & ResourceAndGroupId;

function BuildResourceId(resourceGroupName: string, resourceName: string)
{
    return "/" + resourceGroupName + "/" + resourceProviders.networkServices.name + "/" + resourceProviders.networkServices.dnsServerResourceType.name + "/" + resourceName;
}

const recordsViewModel: ListViewModel<DNS_Record, ZoneId> = {
    type: "list",
    actions: [
        {
            type: "create",
            createResource: (service, ids, record) => service.resourceProviders._any_.networkservices.dnsserver._any_.zones._any_.records.post(ids.resourceGroupName, ids.resourceName, ids.zoneName, record),
            schemaName: "DNS_Record"
        }
    ],
    boundActions: [
        {
            type: "edit",
            schemaName: "DNS_Record",
            updateResource: (service, ids, index, properties) => service.resourceProviders._any_.networkservices.dnsserver._any_.zones._any_.records._any_.put(ids.resourceGroupName, ids.resourceName, ids.zoneName, index, properties),
        },
        {
            type: "delete",
            deleteResource: (service, ids, record) => service.resourceProviders._any_.networkservices.dnsserver._any_.zones._any_.records.delete(ids.resourceGroupName, ids.resourceName, ids.zoneName, record)
        }
    ],
    displayName: "Record set",
    requestObjects: (service, ids) => service.resourceProviders._any_.networkservices.dnsserver._any_.zones._any_.records.get(ids.resourceGroupName, ids.resourceName, ids.zoneName),
    schemaName: "DNS_Record"
};

const zoneViewModel: MultiPageViewModel<ZoneId> = {
    type: "multiPage",
    actions: [
        {
            type: "delete",
            deleteResource: (service, ids) => service.resourceProviders._any_.networkservices.dnsserver._any_.zones._any_.delete(ids.resourceGroupName, ids.resourceName, ids.zoneName)
        }
    ],
    entries: [
        {
            displayName: "",
            entries: [
                {
                    child: recordsViewModel,
                    displayName: "Records",
                    key: "records",
                }
            ]
        }
    ],
    formTitle: ids => ids.zoneName,
};

const zonesViewModel: CollectionViewModel<DNS_ZoneDTO, ResourceAndGroupId> = {
    type: "collection",
    actions: [
        {
            type: "create",
            createResource: (service, ids, zone) => service.resourceProviders._any_.networkservices.dnsserver._any_.zones.post(ids.resourceGroupName, ids.resourceName, zone),
        }
    ],
    child: zoneViewModel,
    displayName: "Zones",
    extractId: x => x.name,
    idKey: "zoneName",
    requestObjects: (service, ids) => service.resourceProviders._any_.networkservices.dnsserver._any_.zones.get(ids.resourceGroupName, ids.resourceName),
    schemaName: "DNS_ZoneDTO",
};

export const dnsServerViewModel: MultiPageViewModel<ResourceAndGroupId> = {
    actions: [
        ...BuildCommonResourceActions(BuildResourceId)
    ],
    entries: [
        {
            displayName: "",
            entries: [
                {
                    key: "zones",
                    displayName: "Zones",
                    child: zonesViewModel
                }
            ]
        },
        BuildResourceGeneralPageGroupEntry(BuildResourceId),
    ],
    formTitle: ids => ids.resourceName,
    type: "multiPage"
};
