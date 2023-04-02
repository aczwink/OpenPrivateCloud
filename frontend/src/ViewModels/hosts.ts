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

import { Host, HostStorage, HostStorageCreationProperties, HostStorageWithInfo, JournalEntry, PartitionDto, StorageDeviceDto } from "../../dist/api";
import { ListViewModel } from "../UI/ListViewModel";
import { CollectionViewModel, MultiPageViewModel, ObjectViewModel, RoutingViewModel } from "../UI/ViewModel";
import { ViewProcessesListComponent } from "../Views/activitymonitor/ViewProcessesListComponent";
import { HostMonitorComponent } from "../Views/host/HostMonitorComponent";
import { HostUpdateComponent } from "../Views/host/HostUpdateComponent";
import { ShowSMARTInfoComponent } from "../Views/host/ShowSMARTInfoComponent";

const hostOverviewViewModel: ObjectViewModel<Host, HostId> = {
    type: "object",
    actions: [
        {
            type: "confirm",
            execute: (service, ids) => service.hosts._any_.reboot.post(ids.hostName),
            confirmText: "Are you sure that you want to reboot?",
            matIcon: "autorenew",
            title: "Reboot"
        },
        {
            type: "confirm",
            execute: (service, ids) => service.hosts._any_.shutdown.post(ids.hostName),
            confirmText: "Are you sure that you want to shutdown?",
            matIcon: "power_settings_new",
            title: "Shutdown"
        }
    ],
    formTitle: host => host.hostName,
    requestObject: async (service, ids) => service.hosts._any_.get(ids.hostName),
    schemaName: "Host",
};

const logsViewModel: ListViewModel<JournalEntry, HostId> = {
    type: "list",
    actions: [],
    boundActions: [],
    displayName: "Logs",
    requestObjects: (service, ids) => service.hosts._any_.logs.get(ids.hostName),
    schemaName: "JournalEntry"
};

const storageViewModel: ObjectViewModel<HostStorageWithInfo, { hostName: string, storageId: number }> = {
    type: "object",
    actions: [
        {
            type: "delete",
            deleteResource: (service, ids) => service.hostStorages._any_.delete(ids.storageId),
        }
    ],
    formTitle: x => x.path,
    requestObject: (service, ids) => service.hostStorages._any_.get(ids.storageId),
    schemaName: "HostStorageWithInfo",
};

type HostId = { hostName: string };

const storagesViewModel: CollectionViewModel<HostStorage, HostId, HostStorageCreationProperties> = {
    type: "collection",
    actions: [
        {
            type: "create",
            createResource: (service, ids, props) => service.hosts._any_.storages.post(ids.hostName, { props }),
            schemaName: "HostStorageCreationProperties"
        }
    ],
    child: storageViewModel,
    displayName: "Host-storage",
    extractId: x => x.id,
    idKey: "storageId",
    requestObjects: (service, ids) => service.hosts._any_.storages.get(ids.hostName),
    schemaName: "HostStorage",
};

type StorageDeviceId = Host & { storageDevicePath: string };

const partitionsViewModel: ListViewModel<PartitionDto, StorageDeviceId> =
{
    type: "list",
    actions: [],
    boundActions: [],
    displayName: "Partitions",
    requestObjects: (service, ids) => service.hosts._any_.storageDevices.partitions.get(ids.hostName, { devicePath: ids.storageDevicePath }),
    schemaName: "PartitionDto"
}

const storageDeviceViewModel: MultiPageViewModel<StorageDeviceId> = {
    actions: [
        {
            type: "activate",
            execute: (service, ids) => service.hosts._any_.storageDevices.post(ids.hostName, { devicePath: ids.storageDevicePath }),
            matIcon: "power_settings_new",
            title: "Power-off"
        }
    ],
    entries: [
        {
            displayName: "",
            entries: [
                {
                    key: "partitions",
                    displayName: "Partitions",
                    child: partitionsViewModel,
                },
                {
                    key: "health",
                    displayName: "Health",
                    child: {
                        type: "component",
                        component: ShowSMARTInfoComponent
                    }
                }
            ]
        }
    ],
    formTitle: x => x.storageDevicePath,
    type: "multiPage"
};

const storageDevicesViewModel: CollectionViewModel<StorageDeviceDto, HostId> = {
    type: "collection",
    actions: [],
    child: storageDeviceViewModel,
    displayName: "Host-storage devices",
    extractId: x => x.devicePath,
    idKey: "storageDevicePath",
    requestObjects: (service, ids) => service.hosts._any_.storageDevices.get(ids.hostName),
    schemaName: "StorageDeviceDto",
};

const hostViewModel: MultiPageViewModel<HostId> = {
    type: "multiPage",
    actions: [
        {
            type: "delete",
            deleteResource: (service, ids) => service.hosts._any_.delete(ids.hostName),
        }
    ],
    formTitle: ids => ids.hostName,
    entries: [
        {
            displayName: "",
            entries: [
                {
                    child: hostOverviewViewModel,
                    displayName: "Overview",
                    key: "overview"
                },
                {
                    child: {
                        type: "component",
                        component: HostMonitorComponent,
                    },
                    displayName: "Monitor",
                    key: "monitor",
                    icon: {
                        type: "material",
                        name: "speed"
                    }
                },
                {
                    child: {
                        type: "component",
                        component: ViewProcessesListComponent
                    },
                    displayName: "Activity monitor",
                    key: "activitymonitor",
                    icon: {
                        type: "bootstrap",
                        name: "activity"
                    }
                },
                {
                    child: logsViewModel,
                    displayName: "Logs",
                    key: "logs",
                },
                {
                    key: "update",
                    displayName: "Update",
                    child: {
                        type: "component",
                        component: HostUpdateComponent
                    },
                    icon: {
                        type: "material",
                        name: "update"
                    }
                },
                {
                    child: storagesViewModel,
                    displayName: "Storages",
                    key: "storages",
                    icon: {
                        type: "material",
                        name: "album"
                    }
                },
                {
                    child: storageDevicesViewModel,
                    displayName: "Storage devices",
                    key: "storage-devices",
                    icon: {
                        type: "material",
                        name: "storage"
                    }
                }
            ]
        }
    ],
};

const hostsViewModel: CollectionViewModel<Host, {}> = {
    type: "collection",
    actions: [
        {
            type: "create",
            createResource: (service, _, host) => service.hosts.post(host),
        }
    ],
    child: hostViewModel,
    displayName: "Hosts",
    extractId: host => host.hostName,
    idKey: "hostName",
    requestObjects: service => service.hosts.get(),
    schemaName: "Host",
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