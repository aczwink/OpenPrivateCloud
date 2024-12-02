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
import { RouteSetup } from "acfrontendex";
import { AddHostDTO, FirewallRule, Host, HostBootEntryDTO, HostHealthData, HostStorage, HostStorageWithInfo, NetworkInterfaceDTO, PartitionDto, PortForwardingRule, StorageDeviceDto, UpdateHostPasswordDTO } from "../../dist/api";
import { JSX_CreateElement, Use } from "acfrontend";
import { APIService } from "../services/APIService";
import { APISchemaOf } from "../api-info";
import { AuthGuard } from "../AuthGuard";
import { HostUpdateComponent } from "../components/host/HostUpdateComponent";
import { HostMonitorComponent } from "../components/host/HostMonitorComponent";
import { ViewProcessesListComponent } from "../components/activitymonitor/ViewProcessesListComponent";
import { DataExplorerComponent } from "../components/data-explorer/DataExplorerComponent";
import { HostFirewallTracingComponent } from "../components/host/HostFirewallTracingComponent";
import { NetworkTraceSimulationComponent } from "../components/host/NetworkTraceSimulationComponent";
import { ShowSMARTInfoComponent } from "../components/host/ShowSMARTInfoComponent";
import { ClusterLockedGuard } from "../ClusterLockedGuard";
import { ResourceListComponent } from "../components/resources/ResourceListComponent";

const addHostRoute: RouteSetup<{}, AddHostDTO> = {
    content: {
        type: "create",
        call: (_, host) => Use(APIService).hosts.post(host),
        schema: APISchemaOf(x => x.AddHostDTO),
    },
    displayText: "Add host",
    icon: "plus",
    routingKey: "add",
};

type HostId = { hostName: string };
type StorageDeviceId = Host & { storageDevicePath: string };

const hostOverviewViewModel: RouteSetup<HostId, HostHealthData> = {
    content: {
        type: "object",
        actions: [
            {
                type: "confirm",
                execute: ids => Use(APIService).hosts._any_.reboot.post(ids.hostName),
                confirmText: "Are you sure that you want to reboot?",
                icon: "arrow-clockwise",
                title: "Reboot"
            },
            {
                type: "confirm",
                execute: ids => Use(APIService).hosts._any_.shutdown.post(ids.hostName),
                confirmText: "Are you sure that you want to shutdown?",
                icon: "power",
                title: "Shutdown"
            }
        ],
        formTitle: host => host.hostName,
        requestObject: ids => Use(APIService).hosts._any_.get(ids.hostName),
        schema: APISchemaOf(x => x.HostHealthData)
    },
    displayText: "Overview",
    icon: "binoculars",
    routingKey: "overview",
};

const bootsViewModel: RouteSetup<HostId, HostBootEntryDTO> = {
    content: {
        type: "list",
        requestObjects: ids => Use(APIService).hosts._any_.boots.get(ids.hostName),
        schema: APISchemaOf(x => x.HostBootEntryDTO),
    },
    displayText: "Boots",
    icon: "bootstrap",
    routingKey: "boots",
};

const syslogViewModel: RouteSetup<HostId> = {
    content: {
        type: "multiPage",
        actions: [],
        entries: [
            {
                displayName: "",
                entries: [
                    {
                        content: {
                            type: "element",
                            element: ids => {                            
                                const query = `
                                source hosts.${ids.hostName}.syslog.boot
                                | filter PRIORITY <= 3`;
    
                                return <DataExplorerComponent query={query} />;
                            }
                        },
                        displayText: "Important",
                        icon: "exclamation-circle",
                        routingKey: "important",
                    },
                    bootsViewModel,
                    {
                        content: {
                            type: "element",
                            element: ids => {                            
                                const query = `
                                source hosts.${ids.hostName}.syslog.lastBoot
                                | filter PRIORITY <= 3`;
    
                                return <DataExplorerComponent query={query} />;
                            }
                        },
                        displayText: "Last boot",
                        icon: "newspaper",
                        routingKey: "lastboot",
                    },
                ]
            }
        ],
        formTitle: _ => "System logs"
    },
    displayText: "System logs",
    icon: "journal",
    routingKey: "syslog",
};

const nicsViewModel: RouteSetup<HostId, NetworkInterfaceDTO> = {
    content: {
        type: "list",
        requestObjects: ids => Use(APIService).hosts._any_.networkInterfaces.get(ids.hostName),
        schema: APISchemaOf(x => x.NetworkInterfaceDTO),
    },
    displayText: "Network interfaces",
    icon: "pci-card-network",
    routingKey: "nics",
};

const partitionsViewModel: RouteSetup<StorageDeviceId, PartitionDto> =
{
    content: {
        type: "list",
        requestObjects: ids => Use(APIService).hosts._any_.storageDevices.partitions.get(ids.hostName, { devicePath: ids.storageDevicePath }),
        schema: APISchemaOf(x => x.PartitionDto),
    },
    displayText: "Partitions",
    icon: "segmented-nav",
    routingKey: "partitions",
}

const storageDeviceViewModel: RouteSetup<StorageDeviceId> = {
    content: {
        type: "multiPage",
        actions: [
            {
                type: "activate",
                execute: ids => Use(APIService).hosts._any_.storageDevices.post(ids.hostName, { devicePath: ids.storageDevicePath }),
                icon: "power",
                title: "Power-off"
            }
        ],
        entries: [
            {
                displayName: "",
                entries: [
                    partitionsViewModel,
                    {
                        content: {
                            type: "component",
                            component: ShowSMARTInfoComponent
                        },
                        displayText: "Health",
                        icon: "heart-pulse",
                        routingKey: "health",
                    }
                ]
            }
        ],
        formTitle: x => x.storageDevicePath,
    },
    displayText: "Storage device",
    icon: "device-hdd",
    routingKey: "{storageDevicePath}",
};

const storageDevicesViewModel: RouteSetup<HostId, StorageDeviceDto> = {
    content: {
        type: "collection",
        child: storageDeviceViewModel,
        id: "devicePath",
        requestObjects: ids => Use(APIService).hosts._any_.storageDevices.get(ids.hostName),
        schema: APISchemaOf(x => x.StorageDeviceDto),
    },
    displayText: "Storage devices",
    icon: "device-hdd",
    routingKey: "storage-devices"
};

function BuildFirewallViewModel(direction: "Inbound" | "Outbound")
{
    const createRuleRoute: RouteSetup<HostId, FirewallRule> = {
        content: {
            type: "create",
            call: (ids, rule) => Use(APIService).hosts._any_.firewall._any_.put(ids.hostName, direction, rule),
            schema: APISchemaOf(x => x.FirewallRule)
        },
        displayText: "Add rule",
        icon: "plus",
        routingKey: "add",
    };
    const firewallViewModel: RouteSetup<HostId, FirewallRule> = {
        content: {
            type: "list",
            actions: [
                createRuleRoute
            ],
            boundActions: [
                {
                    type: "edit",
                    schema: APISchemaOf(x => x.FirewallRule),
                    updateResource: async (ids, rule, originalRule) => {
                        await Use(APIService).hosts._any_.firewall._any_.delete(ids.hostName, direction, { priority: originalRule.priority });
                        return Use(APIService).hosts._any_.firewall._any_.put(ids.hostName, direction, rule);
                    },
                },
                {
                    type: "delete",
                    deleteResource: (ids, rule) => Use(APIService).hosts._any_.firewall._any_.delete(ids.hostName, direction, { priority: rule.priority }),
                }
            ],
            requestObjects: ids => Use(APIService).hosts._any_.firewall._any_.get(ids.hostName, direction),
            schema: APISchemaOf(x => x.FirewallRule)
        },
        displayText: direction + " firewall rules - External Zone",
        icon: "bricks",
        routingKey: direction.toLowerCase() + "fw",
    };

    return firewallViewModel;
}

const createPortForwardingViewModel: RouteSetup<HostId, PortForwardingRule> = {
    content: {
        type: "create",
        call: (ids, rule) => Use(APIService).hosts._any_.portForwarding.post(ids.hostName, rule),
        schema: APISchemaOf(x => x.PortForwardingRule),
    },
    displayText: "Create port forwarding rule",
    icon: "plus",
    routingKey: "create",
};

const portForwardingViewModel: RouteSetup<HostId, PortForwardingRule> = {
    content: {
        type: "list",
        actions: [createPortForwardingViewModel],
        boundActions: [
            {
                type: "delete",
                deleteResource: (ids, rule) => Use(APIService).hosts._any_.portForwarding._any_._any_.delete(ids.hostName, rule.protocol, rule.port),
            }
        ],
        requestObjects: ids => Use(APIService).hosts._any_.portForwarding.get(ids.hostName),
        schema: APISchemaOf(x => x.PortForwardingRule),
    },
    displayText: "Port forwarding rules",
    icon: "door-open-fill",
    routingKey: "portforwarding"
};

const createStorageRouteSetup: RouteSetup<HostId, HostStorage> = {
    content: {
        type: "create",
        call: (ids, props) => Use(APIService).hosts._any_.storages.post(ids.hostName, { props }),
        schema: APISchemaOf(x => x.HostStorageCreationProperties)
    },
    displayText: "Create storage",
    icon: "plus",
    routingKey: "create",
};

const storageViewModel: RouteSetup<{ hostName: string, storageId: number }, HostStorageWithInfo> = {
    content: {
        type: "object",
        actions: [
            {
                type: "delete",
                deleteResource: ids => Use(APIService).hostStorages._any_.delete(ids.storageId),
            }
        ],
        formTitle: (_, x) => x.path,
        requestObject: ids => Use(APIService).hostStorages._any_.get(ids.storageId),
        schema: APISchemaOf(x => x.HostStorageWithInfo)
    },
    displayText: "Host-storage",
    icon: "hdd",
    routingKey: "{storageId}",
};

const storagesViewModel: RouteSetup<HostId, HostStorage> = {
    content: {
        type: "collection",
        actions: [createStorageRouteSetup],
        child: storageViewModel,
        id: "id",
        requestObjects: ids => Use(APIService).hosts._any_.storages.get(ids.hostName),
        schema: APISchemaOf(x => x.HostStorage)
    },
    displayText: "Storages",
    icon: "hdd-rack",
    routingKey: "storages"
};

const reconnectViewModel: RouteSetup<HostId, UpdateHostPasswordDTO> = {
    content: {
        type: "object",
        actions: [
            {
                type: "edit",
                requestObject: async _ => ({
                    data: {
                        password: ""
                    },
                    statusCode: 200,
                    rawBody: ""
                }),
                schema: APISchemaOf(x => x.UpdateHostPasswordDTO),
                updateResource: (ids, props) => Use(APIService).hosts._any_.password.put(ids.hostName, props),
            }
        ],
        formTitle: _ => "Reconnect",
        requestObject: async _ => ({
            data: {
                password: ""
            },
            statusCode: 200,
            rawBody: ""
        }),
        schema: APISchemaOf(x => x.UpdateHostPasswordDTO)
    },
    displayText: "Reconnect",
    icon: "link",
    routingKey: "reconnect",
};

const hostViewModel: RouteSetup<HostId> = {
    content: {
        type: "multiPage",
        actions: [
            {
                type: "delete",
                deleteResource: ids => Use(APIService).hosts._any_.delete(ids.hostName),
            }
        ],
        entries: [
            {
                displayName: "",
                entries: [
                    hostOverviewViewModel,
                    {
                        content: {
                            type: "component",
                            component: HostUpdateComponent,
                        },
                        displayText: "Update",
                        icon: "arrow-clockwise",
                        routingKey: "update",
                    },
                ]
            },
            {
                displayName: "Monitoring",
                entries: [
                    {
                        content: {
                            type: "component",
                            component: HostMonitorComponent
                        },
                        displayText: "Monitor",
                        routingKey: "monitor",
                        icon: "speedometer"
                    },
                    {
                        content: {
                            type: "component",
                            component: ViewProcessesListComponent
                        },
                        displayText: "Activity monitor",
                        routingKey: "activitymonitor",
                        icon: "activity"
                    },
                    syslogViewModel,
                    nicsViewModel,
                    {
                        content: {
                            type: "component",
                            component: HostFirewallTracingComponent
                        },
                        displayText: "Firewall Tracing",
                        icon: "bricks",
                        routingKey: "firewallTracing",
                    },
                    {
                        content: {
                            type: "component",
                            component: NetworkTraceSimulationComponent,
                        },
                        displayText: "Network trace simulation",
                        icon: "signpost-split",
                        routingKey: "networksim",
                    },
                    storageDevicesViewModel,
                    {
                        content: {
                            type: "element",
                            element: ids => <ResourceListComponent query={apiService => apiService.resources.host.get({ hostName: ids.hostName })} />,
                        },
                        displayText: "Resources",
                        icon: "collection",
                        routingKey: "resources",
                    }
                ]
            },
            {
                displayName: "Configuration",
                entries: [
                    BuildFirewallViewModel("Inbound"),
                    BuildFirewallViewModel("Outbound"),
                    portForwardingViewModel,
                    storagesViewModel
                ]
            },
            {
                displayName: "Emergency",
                entries: [
                    reconnectViewModel
                ]
            }
        ],
        formTitle: ids => ids.hostName,
    },
    displayText: "Host",
    icon: "pc",
    routingKey: "{hostName}",
};

export const hostsRoute: RouteSetup<{}, Host> = {
    content: {
        type: "collection",
        actions: [addHostRoute],
        child: hostViewModel,
        id: "hostName",
        requestObjects: _ => Use(APIService).hosts.get(),
        schema: APISchemaOf(x => x.Host)
    },
    displayText: "Hosts",
    guards: [ClusterLockedGuard, AuthGuard],
    icon: "pc",
    routingKey: "hosts",
};