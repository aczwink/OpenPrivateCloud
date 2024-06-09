/**
 * OpenPrivateCloud
 * Copyright (C) 2024 Amir Czwink (amir130@hotmail.de)
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
import { Injectable } from "acts-util-node";
import { IPv4 } from "../common/IPv4";
import { HostsController } from "../data-access/HostsController";
import { FirewallRule, HostFirewallZonesManager } from "./HostFirewallZonesManager";
import { HostNetworkInterfaceCardsManager } from "./HostNetworkInterfaceCardsManager";
import { CIDRRange } from "../common/CIDRRange";
import { VNetManager } from "../resource-providers/network-services/VNetManager";
import { ResourcesManager } from "./ResourcesManager";

interface NetworkTraceSimPacketData
{
    sourceAddress: IPv4;
    targetAddress: IPv4;
    protocol: "TCP" | "UDP";
    port: number;
}

@Injectable
export class NetworkTraceSimulator
{
    constructor(private hostsController: HostsController, private hostFirewallZonesManager: HostFirewallZonesManager, private hostNetworkInterfaceCardsManager: HostNetworkInterfaceCardsManager,
        private vnetManager: VNetManager, private resourcesManager: ResourcesManager,
    )
    {
    }

    //Public methods
    public async ExecuteNetworkTraceSimulation(hostId: number, sourceAddress: IPv4, protocol: "TCP" | "UDP", port: number)
    {
        const packet: NetworkTraceSimPacketData = { port, protocol, sourceAddress, targetAddress: new IPv4(await this.hostNetworkInterfaceCardsManager.QueryExternalIPv4(hostId)) };

        const log: string[] = [];

        log.push("Packet arrived at host " + await this.RequestHostName(hostId));

        if(await this.TryEnterExternalZone(hostId, packet, log))
        {
            log.push("Packet successfully entered zone: external");
            log.push("Packet successfully delivered to host");
        }

        return log;
    }

    //Private methods
    private DoesFirewallRuleAllowPacket(packet: NetworkTraceSimPacketData, rule: FirewallRule)
    {
        function SourceAddressMatches()
        {
            if(rule.source === "Any")
                return true;
            throw new Error("TODO: implement: " + rule.source);
        }

        function PortMatches()
        {
            if(rule.destinationPortRanges === "Any")
                return true;
            const parts = rule.destinationPortRanges.split(";");
            for (const part of parts)
            {
                const sections = part.split("-");
                if((sections.length === 1) && (parseInt(part) === packet.port))
                    return true;
                else if(
                    (parseInt(sections[0]) >= packet.port)
                    &&
                    (parseInt(sections[1]) <= packet.port)
                )
                    return true;
            }
            return false;
        }

        const conditionMatches = (packet.protocol === rule.protocol) && SourceAddressMatches() && PortMatches();
        if(conditionMatches)
            return rule.action;
    }

    private async RequestHostName(hostId: number)
    {
        const host = await this.hostsController.QueryHost(hostId);
        if(host === undefined)
            return "host not found. Should never happen";
        return host.hostName;
    }

    private async RoutePacketOnHost(hostId: number, packet: NetworkTraceSimPacketData, log: string[])
    {
        const data = await this.hostNetworkInterfaceCardsManager.QueryAllNetworkInterfacesWithAddresses(hostId);
        for (const iface of data)
        {
            const ipv4 = iface.addr_info.find(x => x.family === "inet");
            if(ipv4 === undefined)
                continue;

            const ip = new IPv4(ipv4.local);
            const cidr = CIDRRange.FromIP(ip, ipv4.prefixlen);
            if(cidr.Includes(packet.targetAddress))
            {
                if(iface.ifname.startsWith("opc-virbr"))
                {
                    const vnetId = parseInt(iface.ifname.substring("opc-virbr".length));
                    return this.ForwardPacketToVNet(vnetId, packet, log);
                }
                else
                    throw new Error("TODO: not implemented");
            }
        }

        log.push("Packet sent to default gateway. Simulation ended.");
    }

    private async ForwardPacketToVNet(vnetId: number, packet: NetworkTraceSimPacketData, log: string[])
    {
        const vnetRef = await this.resourcesManager.CreateResourceReference(vnetId);

        log.push("Packet trying to enter vnet: " + vnetRef!.externalId);

        const config = await this.vnetManager.QueryConfig(vnetRef!);
        return this.TryEnterFirewall(packet, config.inboundRules, log);
    }

    private async TryEnterExternalZone(hostId: number, packet: NetworkTraceSimPacketData, log: string[])
    {
        log.push("Packet trying to enter zone: external");

        const zones = await this.hostFirewallZonesManager.QueryZones(hostId);
        const zone = zones.external;

        for(const rule of zone.portForwardingRules)
        {
            if((rule.protocol === packet.protocol) && (rule.port === packet.port))
            {
                log.push("Packet is being DNATed to: " + rule.targetAddress + ":" + rule.targetPort);
                await this.RoutePacketOnHost(hostId, {
                    port: rule.targetPort,
                    protocol: rule.protocol,
                    sourceAddress: packet.sourceAddress,
                    targetAddress: new IPv4(rule.targetAddress)
                }, log);
                return false;
            }
        }

        return this.TryEnterFirewall(packet, zone.inboundRules, log);
    }

    private TryEnterFirewall(packet: NetworkTraceSimPacketData, rules: FirewallRule[], log: string[])
    {
        for (const rule of rules)
        {
            const match = this.DoesFirewallRuleAllowPacket(packet, rule);
            if(match === "Allow")
            {
                log.push("Packet was allowed by rule: " + rule.priority);
                return true;
            }
            else if(match === "Deny")
            {
                log.push("Packet was blocked by rule: " + rule.priority);
                return false;
            }
        }

        log.push("Packet was blocked by implicit deny rule");
        return false;
    }
}