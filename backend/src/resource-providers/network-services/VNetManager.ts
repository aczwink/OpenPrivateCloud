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
import path from "path";
import { Injectable } from "acts-util-node";
import { VirtualNetworkProperties } from "./properties";
import { DeploymentContext, ResourceStateResult } from "../ResourceProvider";
import { LightweightResourceReference } from "../../common/ResourceReference";
import { ResourceConfigController } from "../../data-access/ResourceConfigController";
import { HostFirewallManager } from "../../services/HostFirewallManager";
import { RemoteCommandExecutor } from "../../services/RemoteCommandExecutor";
import { CIDRRange } from "../../common/CIDRRange";
import { SysCtlConfService } from "./SysCtlConfService";
import { ResourcesManager } from "../../services/ResourcesManager";
import { FirewallRule, FirewallZoneData, FirewallZoneDataProvider } from "../../services/HostFirewallZonesManager";
import { dnsmasqManager } from "./dnsmasqManager";
import { HostNetworkInterfaceCardsManager } from "../../services/HostNetworkInterfaceCardsManager";
import { ModulesManager } from "../../services/ModulesManager";
import { DistroInfoService } from "../../services/DistroInfoService";

interface VNetSettings
{
    /**
     * CIDR-range
     */
    addressSpace: string;

    enableDHCPv4: boolean;
}

export interface VNetConfig
{
    inboundRules: FirewallRule[];
    outboundRules: FirewallRule[];
    settings: VNetSettings;
}

/**
 * Documentation concerning VNet firewall:
 * https://libvirt.org/firewall.html
 * https://jamielinux.com/docs/libvirt-networking-handbook/appendix/example-of-iptables-nat.html
 * https://wiki.qemu.org/Documentation/Networking/NAT
 */

@Injectable
export class VNetManager implements FirewallZoneDataProvider
{
    constructor(private resourceConfigController: ResourceConfigController, private remoteCommandExecutor: RemoteCommandExecutor, private sysCtlConfService: SysCtlConfService, private modulesManager: ModulesManager,
        private resourcesManager: ResourcesManager, private hostFirewallManager: HostFirewallManager, private dnsmasqManager: dnsmasqManager, private hostNetworkInterfaceCardsManager: HostNetworkInterfaceCardsManager,
        private distroInfoService: DistroInfoService)
    {
    }

    //Properties
    public get matchingZonePrefix(): string
    {
        return "vnet-";
    }

    //Public methods
    public async DeleteResource(resourceReference: LightweightResourceReference)
    {
        const bridgeName = this.DeriveBridgeName(resourceReference);

        const existsDocker = await this.DoesDockerNetworkExist(resourceReference);
        if(existsDocker)
        {
            const dockerNetName = this.DeriveDockerNetworkName(resourceReference);
            await this.remoteCommandExecutor.ExecuteCommand(["sudo", "docker", "network", "rm", dockerNetName], resourceReference.hostId);
        }

        const exists = await this.DoesBridgeExist(resourceReference);
        if(exists)
            await this.hostNetworkInterfaceCardsManager.DeleteBridge(resourceReference.hostId, bridgeName);

        await this.dnsmasqManager.DeleteService(resourceReference);

        await this.resourcesManager.RemoveResourceStorageDirectory(resourceReference);
    }

    public async DeleteFirewallRule(resourceReference: LightweightResourceReference, direction: "Inbound" | "Outbound", priority: number)
    {
        const config = await this.QueryConfig(resourceReference);
        const rules = (direction === "Inbound") ? config.inboundRules : config.outboundRules;

        const idx = rules.findIndex(x => x.priority === priority);
        rules.Remove(idx);

        await this.resourceConfigController.UpdateOrInsertConfig(resourceReference.id, config);
        await this.hostFirewallManager.ApplyRuleSet(resourceReference.hostId);
    }

    public async EnsureDockerNetworkExists(resourceReference: LightweightResourceReference)
    {
        const dockerNetName = this.DeriveDockerNetworkName(resourceReference);

        const exists = await this.DoesDockerNetworkExist(resourceReference);
        if(!exists)
        {
            await this.modulesManager.EnsureModuleIsInstalled(resourceReference.hostId, "docker");

            const bridgeName = this.DeriveBridgeName(resourceReference);
            const arch = await this.distroInfoService.FetchCPU_Architecture(resourceReference.hostId);
            const pluginArch = (arch === "arm64") ? "arm64-v8" : "amd64";
            const driverName = "ghcr.io/aczwink/docker-net-dhcp:latest-linux-" + pluginArch;
            await this.remoteCommandExecutor.ExecuteCommand(["sudo", "docker", "network", "create", "-d", driverName, "--ipam-driver", "null", "-o", "bridge=" + bridgeName, dockerNetName], resourceReference.hostId);
        }

        const config = await this.QueryConfig(resourceReference);
        const range = new CIDRRange(config.settings.addressSpace);
        return {
            name: dockerNetName,
            primaryDNS_Server: this.SubdivideAddressSpace(range).gatewayIP.ToString() //always use gateway as DNS server
        };
    }

    public MatchNetworkInterfaceName(nicName: string): string | null
    {
        if(nicName.startsWith("opc-virbr"))
            return "vnet-" + nicName.substring(9);
        return null;
    }

    public async ProvideData(hostId: number, zoneName: string): Promise<FirewallZoneData>
    {
        const resourceId = parseInt(zoneName.substring("vnet-".length));
        const ref = await this.resourcesManager.CreateResourceReference(resourceId);
        const config = await this.QueryConfig(ref!);

        return {
            addressSpace: new CIDRRange(config.settings.addressSpace),
            inboundRules: config.inboundRules,
            outboundRules: config.outboundRules,
            portForwardingRules: [],
        };
    }

    public async ProvideResource(instanceProperties: VirtualNetworkProperties, context: DeploymentContext)
    {
        const inboundRules: FirewallRule[] = [];
        const outboundRules: FirewallRule[] = [];
        if(instanceProperties.enableDHCPv4)
        {
            inboundRules.push({
                priority: 100,
                destinationPortRanges: "53",
                protocol: "Any",
                source: "Any",
                destination: "Any",
                action: "Allow",
                comment: "DNS. Required for VMs and Containers!"
            });
            inboundRules.push({
                priority: 101,
                destinationPortRanges: "68",
                protocol: "Any",
                source: "Any",
                destination: "Any",
                action: "Allow",
                comment: "DHCP Client. Required for VMs and Containers!"
            });

            outboundRules.push({
                priority: 100,
                destinationPortRanges: "53",
                protocol: "Any",
                source: "Any",
                destination: "Any",
                action: "Allow",
                comment: "DNS. Required for VMs and Containers!"
            });
            outboundRules.push({
                priority: 101,
                destinationPortRanges: "67",
                protocol: "Any",
                source: "Any",
                destination: "Any",
                action: "Allow",
                comment: "DHCP Server. Required for VMs and Containers!"
            });
        }

        inboundRules.push({
            priority: 102,
            destinationPortRanges: "Any",
            protocol: "ICMP",
            source: "Any",
            destination: "Any",
            action: "Allow",
            comment: "Ping. Recommended for diagnosis"
        });
        inboundRules.push({
            priority: 103,
            destinationPortRanges: "22",
            protocol: "TCP",
            source: "Any",
            destination: "Any",
            action: "Allow",
            comment: "SSH. Recommended for diagnosis"
        });
        inboundRules.push({
            priority: 1000,
            destinationPortRanges: "Any",
            protocol: "Any",
            source: instanceProperties.addressSpace,
            destination: instanceProperties.addressSpace,
            action: "Allow",
            comment: "Allow communication inside the vnet"
        });

        const config: VNetConfig = {
            settings: {
                addressSpace: instanceProperties.addressSpace,
                enableDHCPv4: instanceProperties.enableDHCPv4
            },
            inboundRules,
            outboundRules
        };
        await this.resourceConfigController.UpdateOrInsertConfig(context.resourceReference.id, config);

        await this.resourcesManager.CreateResourceStorageDirectory(context.resourceReference);
        await this.CreateBridge(context.resourceReference);
        await this.sysCtlConfService.SetIPForwardingState(context.hostId, true);

        if(instanceProperties.enableDHCPv4)
            await this.StartDNS_DHCP_Server(context.resourceReference);

        await this.hostFirewallManager.ApplyRuleSet(context.hostId);
    }

    public async QueryConfig(resourceReference: LightweightResourceReference): Promise<VNetConfig>
    {
        const config = await this.resourceConfigController.QueryConfig<VNetConfig>(resourceReference.id);
        return config!;
    }

    public async QueryResourceState(resourceReference: LightweightResourceReference): Promise<ResourceStateResult>
    {
        const exists = await this.DoesBridgeExist(resourceReference);
        if(!exists)
            return { state: "down", context: "bridge is down" };
        return "running";
    }

    public async SetFirewallRule(resourceReference: LightweightResourceReference, direction: "Inbound" | "Outbound", rule: FirewallRule)
    {
        const config = await this.QueryConfig(resourceReference);
        const rules = (direction === "Inbound") ? config.inboundRules : config.outboundRules;

        const idx = rules.findIndex(x => x.priority === rule.priority);
        if(idx === -1)
        {
            rules.push(rule);
            rules.SortBy(x => x.priority);
        }
        else
        {
            rules[idx] = rule;
        }

        await this.resourceConfigController.UpdateOrInsertConfig(resourceReference.id, config);
        await this.hostFirewallManager.ApplyRuleSet(resourceReference.hostId);
    }

    //Private methods
    private async CreateBridge(resourceReference: LightweightResourceReference)
    {
        const bridgeName = this.DeriveBridgeName(resourceReference);
        const config = await this.QueryConfig(resourceReference);
        const range = new CIDRRange(config.settings.addressSpace);
        const subdiv = this.SubdivideAddressSpace(range);

        await this.hostNetworkInterfaceCardsManager.CreateBridge(resourceReference.hostId, bridgeName, subdiv.gatewayIP, range.length);
    }

    private DeriveBridgeName(resourceReference: LightweightResourceReference)
    {
        return "opc-virbr" + resourceReference.id;
    }

    private DeriveDockerNetworkName(resourceReference: LightweightResourceReference)
    {
        return "opc-rdnet" + resourceReference.id;
    }

    private async DoesBridgeExist(resourceReference: LightweightResourceReference)
    {
        const bridgeName = this.DeriveBridgeName(resourceReference);
        return await this.hostNetworkInterfaceCardsManager.DoesInterfaceExist(resourceReference.hostId, bridgeName);
    }

    private async DoesDockerNetworkExist(resourceReference: LightweightResourceReference)
    {
        const dockerNetName = this.DeriveDockerNetworkName(resourceReference);
        const result = await this.remoteCommandExecutor.ExecuteCommandWithExitCode(["sudo", "docker", "network", "inspect", dockerNetName], resourceReference.hostId);
        return result === 0;
    }

    private SubdivideAddressSpace(addressSpace: CIDRRange)
    {
        return {
            gatewayIP: addressSpace.netAddress.Next(), //first address after the netaddress is the gateway IP
            firstDHCP_Address: addressSpace.netAddress.Next().Next(),
            lastDHCP_Address: addressSpace.brodcastAddress.Prev(),
        }
    }

    private async StartDNS_DHCP_Server(resourceReference: LightweightResourceReference)
    {
        const resourceDir = this.resourcesManager.BuildResourceStoragePath(resourceReference);
        const config = await this.QueryConfig(resourceReference);
        const range = new CIDRRange(config.settings.addressSpace);
        const subdiv = this.SubdivideAddressSpace(range);

        const bridgeName = this.DeriveBridgeName(resourceReference);
        const dhcpRange = subdiv.firstDHCP_Address.ToString() + "," + subdiv.lastDHCP_Address.ToString();

        const leasePath = path.join(resourceDir, "dnsmasq.leases");

        const dnsmasqConfig = `
strict-order
dhcp-range=${dhcpRange}
dhcp-leasefile=${leasePath}
dhcp-no-override
dhcp-authoritative
        `;

        await this.dnsmasqManager.UpdateService(resourceReference, {
            configDirPath: resourceDir,
            configContent: dnsmasqConfig,
            networkInterface: bridgeName
        });
    }
}