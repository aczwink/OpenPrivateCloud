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

import { Host, HostStorage, HostStorageCreationProperties } from "../../dist/api";
import { APIService } from "../Services/APIService";
import { CollectionViewModel, MultiPageViewModel, ObjectViewModel, ViewModelRoot } from "../UI/ViewModel";

const storageViewModel: ObjectViewModel<HostStorage, { hostName: string, storagePath: string }, APIService> = {
    type: "object",
    actions: [
        {
            type: "delete",
            deleteResource: async (service, ids) => {
                await service.hosts_any_storage.delete(ids.hostName, { storagePath: ids.storagePath })
            },
        }
    ],
    formTitle: x => x.storagePath,
    requestObject: async (service, ids) => {
        const response = await service.hosts_any_storage.get(ids.hostName, { storagePath: ids.storagePath });
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
                await service.hosts_any_storages.post(ids.hostName, { props });
            },
            schemaName: "HostStorageCreationProperties"
        }
    ],
    child: storageViewModel,
    displayName: "Host-storage",
    extractId: x => x.storagePath,
    idKey: "storagePath",
    requestObjects: async (service, ids) => {
        const response = await service.hosts_any_storages.get(ids.hostName);
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

const hostOverviewViewModel: ObjectViewModel<Host, HostId, APIService> = {
    type: "object",
    actions: [],
    formTitle: host => host.hostName,
    requestObject: async (service, ids) => {
        const response = await service.hosts_any_.get(ids.hostName);
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

const hostViewModel: MultiPageViewModel<HostId, APIService> = {
    type: "multiPage",
    actions: [
        {
            type: "delete",
            deleteResource: async (service, ids) => {
                await service.hosts_any_.delete(ids.hostName);
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

const root: ViewModelRoot = {
    key: "hosts",
    viewModel: hostsViewModel,
}

export default root;