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

import { Host, HostStorage, HostStorageCreationProperties, Partition, StorageDeviceDto } from "../../dist/api";
import { APIService } from "../Services/APIService";
import { ListViewModel } from "../UI/ListViewModel";
import { CollectionViewModel, MultiPageViewModel, ObjectViewModel, RoutingViewModel } from "../UI/ViewModel";

const hostOverviewViewModel: ObjectViewModel<Host, HostId, APIService> = {
    type: "object",
    actions: [],
    formTitle: host => host.hostName,
    requestObject: async (service, ids) => {
        const response = await service.hosts._any_.get(ids.hostName);
        switch(response.statusCode)
        {
            case 404:
                throw new Error("not found");
        }
        return response.data;
    },
    schemaName: "Host",
    service: APIService,
};

const storageViewModel: ObjectViewModel<HostStorage, { hostName: string, storageId: number }, APIService> = {
    type: "object",
    actions: [
        {
            type: "delete",
            deleteResource: async (service, ids) => {
                await service.hostStorages._any_.delete(ids.storageId);
            },
        }
    ],
    formTitle: x => x.path,
    requestObject: async (service, ids) => {
        const response = await service.hostStorages._any_.get(ids.storageId);
        switch(response.statusCode)
        {
            case 404:
                throw new Error("not found");
        }
        return response.data;
    },
    schemaName: "HostStorage",
    service: APIService
};

type HostId = { hostName: string };

const storagesViewModel: CollectionViewModel<HostStorage, HostId, APIService, HostStorageCreationProperties> = {
    type: "collection",
    actions: [
        {
            type: "create",
            createResource: async (service, ids, props) => {
                await service.hosts._any_.storages.post(ids.hostName, { props });
            },
            schemaName: "HostStorageCreationProperties"
        }
    ],
    child: storageViewModel,
    displayName: "Host-storage",
    extractId: x => x.id,
    idKey: "storageId",
    requestObjects: async (service, ids) => {
        const response = await service.hosts._any_.storages.get(ids.hostName);
        switch(response.statusCode)
        {
            case 404:
                throw new Error("not found");
        }
        return response.data;
    },
    schemaName: "HostStorage",
    service: APIService,
};

const partitionsViewModel: ListViewModel<Partition, Host & { storageDevicePath: string }> =
{
    type: "list",
    actions: [],
    boundActions: [],
    displayName: "Partitions",
    requestObjects: async (service, ids) => {
        const response = await service.hosts._any_.storageDevices.partitions.get(ids.hostName, { devicePath: ids.storageDevicePath })
        if(response.statusCode != 200)
            throw new Error("not implemented");
        return response.data;
    },
    schemaName: "Partition"
}

const storageDevicesViewModel: CollectionViewModel<StorageDeviceDto, HostId, APIService> = {
    type: "collection",
    actions: [],
    child: partitionsViewModel,
    displayName: "Host-storage devices",
    extractId: x => x.devicePath,
    idKey: "storageDevicePath",
    requestObjects: async (service, ids) => {
        const response = await service.hosts._any_.storageDevices.get(ids.hostName);
        switch(response.statusCode)
        {
            case 404:
                throw new Error("not found");
        }
        return response.data;
    },
    schemaName: "StorageDeviceDto",
    service: APIService,
};

const hostViewModel: MultiPageViewModel<HostId, APIService> = {
    type: "multiPage",
    actions: [
        {
            type: "delete",
            deleteResource: async (service, ids) => {
                await service.hosts._any_.delete(ids.hostName);
            },
        }
    ],
    formTitle: ids => ids.hostName,
    entries: [
        {
            child: hostOverviewViewModel,
            displayName: "Overview",
            key: "overview"
        },
        {
            child: storagesViewModel,
            displayName: "Storages",
            key: "storages"
        },
        {
            child: storageDevicesViewModel,
            displayName: "Storage devices",
            key: "storage-devices"
        }
    ],
    service: APIService,
};

const hostsViewModel: CollectionViewModel<Host, {}, APIService> = {
    type: "collection",
    actions: [
        {
            type: "create",
            createResource: async (service, _, host) => {
                await service.hosts.post(host);
            },
        }
    ],
    child: hostViewModel,
    displayName: "Hosts",
    extractId: host => host.hostName,
    idKey: "hostName",
    requestObjects: async service => (await service.hosts.get()).data,
    schemaName: "Host",
    service: APIService,
};

const root: RoutingViewModel = {
    type: "routing",
    entries: [
        {
            key: "hosts",
            viewModel: hostsViewModel,
        }
    ]
}

export default root;