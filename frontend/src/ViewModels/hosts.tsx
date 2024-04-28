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

import { JSX_CreateElement } from "acfrontend";
import { FirewallRule, Host, HostBootEntryDTO, HostHealthData, HostStorage, HostStorageCreationProperties, HostStorageWithInfo, NetworkInterfaceDTO, PartitionDto, PortForwardingRule, StorageDeviceDto } from "../../dist/api";
import { ListViewModel } from "../UI/ListViewModel";
import { CollectionViewModel, MultiPageViewModel, ObjectViewModel, RoutingViewModel } from "../UI/ViewModel";
import { ViewProcessesListComponent } from "../Views/activitymonitor/ViewProcessesListComponent";
import { DataExplorerComponent } from "../Views/data-explorer/DataExplorerComponent";
import { HostFirewallTracingComponent } from "../Views/host/HostFirewallTracingComponent";
import { HostMonitorComponent } from "../Views/host/HostMonitorComponent";
import { HostUpdateComponent } from "../Views/host/HostUpdateComponent";
import { ShowSMARTInfoComponent } from "../Views/host/ShowSMARTInfoComponent";
import { ExtractDataFromResponseOrShowErrorMessageOnError } from "../UI/ResponseHandler";

const hostOverviewViewModel: ObjectViewModel<HostHealthData, HostId> = {
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
    schemaName: "HostHealthData",
};

//Monitoring
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

const bootsViewModel: ListViewModel<HostBootEntryDTO, HostId> = {
    actions: [],
    boundActions: [],
    displayName: "Boots",
    requestObjects: (service, ids) => service.hosts._any_.boots.get(ids.hostName),
    schemaName: "HostBootEntryDTO",
    type: "list"
};

const syslogViewModel: MultiPageViewModel<HostId> = {
    type: "multiPage",
    actions: [],
    entries: [
        {
            displayName: "",
            entries: [
                {
                    child: {
                        type: "element",
                        element: (_, ids) => {                            
                            const query = `
                            source hosts.${ids.hostName}.syslog.boot
                            | filter PRIORITY <= 3`;

                            return <DataExplorerComponent query={query} />;
                        }
                    },
                    displayName: "Important",
                    key: "important",
                },
                {
                    child: bootsViewModel,
                    displayName: "Boots",
                    key: "boots"
                },
                {
                    child: {
                        type: "element",
                        element: (_, ids) => {                            
                            const query = `
                            source hosts.${ids.hostName}.syslog.lastBoot
                            | filter PRIORITY <= 3`;

                            return <DataExplorerComponent query={query} />;
                        }
                    },
                    displayName: "Last boot",
                    key: "lastboot",
                },
            ]
        }
    ],
    formTitle: _ => "System logs"
};

const nicsViewModel: ListViewModel<NetworkInterfaceDTO, HostId> = {
    type: "list",
    actions: [],
    boundActions: [],
    displayName: "Network interfaces",
    requestObjects: (service, ids) => service.hosts._any_.networkInterfaces.get(ids.hostName),
    schemaName: "NetworkInterfaceDTO"
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

//Configuration
type HostId = { hostName: string };

function BuildFirewallViewModel(direction: "Inbound" | "Outbound")
{
    const firewallViewModel: ListViewModel<FirewallRule, HostId> = {
        type: "list",
        actions: [
            {
                type: "create",
                createResource: (service, ids, rule) => service.hosts._any_.firewall._any_.put(ids.hostName, direction, rule),
            }
        ],
        boundActions: [
            {
                type: "edit",
                schemaName: "FirewallRule",
                updateResource: async (service, ids, rule, originalRule) => {
                    await service.hosts._any_.firewall._any_.delete(ids.hostName, direction, { priority: originalRule.priority });
                    return service.hosts._any_.firewall._any_.put(ids.hostName, direction, rule);
                },
            },
            {
                type: "delete",
                deleteResource: (service, ids, rule) => service.hosts._any_.firewall._any_.delete(ids.hostName, direction, { priority: rule.priority }),
            }
        ],
        displayName: direction + " firewall rules - External Zone",
        requestObjects: (service, ids) => service.hosts._any_.firewall._any_.get(ids.hostName, direction),
        schemaName: "FirewallRule"
    };

    return firewallViewModel;
}

const portForwardingViewModel: ListViewModel<PortForwardingRule, HostId> = {
    type: "list",
    actions: [
        {
            type: "create",
            createResource: (service, ids, rule) => service.hosts._any_.portForwarding.post(ids.hostName, rule),
        }
    ],
    boundActions: [
        {
            type: "delete",
            deleteResource: (service, ids, rule) => service.hosts._any_.portForwarding._any_._any_.delete(ids.hostName, rule.protocol, rule.port),
        }
    ],
    displayName: "Port forwarding rules",
    requestObjects: (service, ids) => service.hosts._any_.portForwarding.get(ids.hostName),
    schemaName: "PortForwardingRule"
};

const storageViewModel: ObjectViewModel<HostStorageWithInfo, { hostName: string, storageId: number }> = {
    type: "object",
    actions: [
        {
            type: "delete",
            deleteResource: (service, ids) => service.hostStorages._any_.delete(ids.storageId),
        }
    ],
    formTitle: (_, x) => x.path,
    requestObject: (service, ids) => service.hostStorages._any_.get(ids.storageId),
    schemaName: "HostStorageWithInfo",
};

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
            ]
        },
        {
            displayName: "Monitoring",
            entries: [
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
                    child: syslogViewModel,
                    displayName: "System logs",
                    key: "syslog"
                },
                {
                    child: nicsViewModel,
                    displayName: "Network interfaces",
                    key: "nics"
                },
                {
                    child: {
                        type: "component",
                        component: HostFirewallTracingComponent
                    },
                    displayName: "Firewall Tracing",
                    key: "firewallTracing"
                },
                {
                    child: storageDevicesViewModel,
                    displayName: "Storage devices",
                    key: "storage-devices",
                    icon: {
                        type: "material",
                        name: "storage"
                    }
                },
            ]
        },
        {
            displayName: "Configuration",
            entries: [
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
                {
                    child: portForwardingViewModel,
                    displayName: "Port forwarding rules",
                    key: "portforwarding",
                    icon: {
                        type: "bootstrap",
                        name: "door-open-fill"
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