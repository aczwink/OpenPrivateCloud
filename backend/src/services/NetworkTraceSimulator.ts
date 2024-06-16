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
import { ResourcesController } from "../data-access/ResourcesController";
import { resourceProviders } from "openprivatecloud-common";

interface VNetPacketLocation
{
    //packet is on some service inside the vnet (i.e. successfully entered the vnet's zone)
    type: "vnet";
    vnetId: number;
}

interface HostPacketLocation
{
    //packet is on host i.e. sucessfully entered external firewall zone, or is being forwarded/routed through it
    type: "host";
    hostId: number;
}

interface HostsNetworkPacketLocation
{
    //i.e. packet is on the host network but not on a host
    type: "hosts-net";
}

type PacketLocation = HostsNetworkPacketLocation | HostPacketLocation | VNetPacketLocation;

class PacketTrace
{
    constructor(private _protocol: "TCP" | "UDP", private _port: number, sourceLocation: PacketLocation, private _targetAddress: IPv4, private _targetLocation: PacketLocation)
    {
        this._log = [];
        this._currentLocation = sourceLocation;
    }

    //Properties
    public get currentLocation()
    {
        return this._currentLocation;
    }

    public get log()
    {
        return this._log;
    }

    public get port()
    {
        return this._port;
    }

    public get protocol()
    {
        return this._protocol;
    }

    public get targetAddress()
    {
        return this._targetAddress;
    }

    public get targetLocation()
    {
        return this._targetLocation;
    }

    //Public methods
    public Trace(log: string)
    {
        this._log.push(log);
    }

    public UpdateLocation(location: PacketLocation)
    {
        this._currentLocation = location;
    }

    public UpdateTarget(targetAddress: IPv4, targetPort: number, targetLocation: PacketLocation)
    {
        this._targetAddress = targetAddress;
        this._targetLocation = targetLocation;
        this._port = targetPort;
    }

    //State
    private _log: string[];
    private _currentLocation: PacketLocation;
}

@Injectable
export class NetworkTraceSimulator
{
    constructor(private hostsController: HostsController, private hostFirewallZonesManager: HostFirewallZonesManager, private hostNetworkInterfaceCardsManager: HostNetworkInterfaceCardsManager,
        private vnetManager: VNetManager, private resourcesManager: ResourcesManager, private resourcesController: ResourcesController,
    )
    {
    }

    //Public methods
    public async ExecuteNetworkTraceSimulation(hostId: number, sourceAddress: IPv4, protocol: "TCP" | "UDP", port: number)
    {
        const sourceLocation = await this.FindPacketLocation(sourceAddress);
        const targetAddress = (await this.hostNetworkInterfaceCardsManager.QueryExternalIPv4Subnet(hostId)).address;

        const targetLocation = await this.FindPacketLocation(targetAddress);
        const trace = new PacketTrace(protocol, port, sourceLocation, targetAddress, targetLocation);

        trace.Trace("Packet origin is: " + await this.PacketLocationToString(sourceLocation));
        await this.RoutePacket(trace);

        return trace.log;
    }

    //Private methods
    private DoesFirewallRuleAllowPacket(trace: PacketTrace, rule: FirewallRule)
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
                if((sections.length === 1) && (parseInt(part) === trace.port))
                    return true;
                else if(
                    (parseInt(sections[0]) >= trace.port)
                    &&
                    (parseInt(sections[1]) <= trace.port)
                )
                    return true;
            }
            return false;
        }

        const conditionMatches = (trace.protocol === rule.protocol) && SourceAddressMatches() && PortMatches();
        if(conditionMatches)
            return rule.action;
    }

    private async FindPacketLocation(address: IPv4): Promise<PacketLocation>
    {
        const hostIds = await this.hostsController.RequestHostIds();
        for (const hostId of hostIds)
        {
            try
            {
                const ip = await this.hostNetworkInterfaceCardsManager.QueryExternalIPv4Subnet(hostId);
                if(address.Equals(ip.address))
                {
                    return {
                        type: "host",
                        hostId
                    };
                }
            }
            catch(_)
            {
            }
        }

        //check vnets
        const vnetIds = await this.resourcesController.Search(resourceProviders.networkServices.name, resourceProviders.networkServices.virtualNetworkResourceType.name, "");
        for (const vnetId of vnetIds)
        {
            const vnetRef = await this.resourcesManager.CreateResourceReference(vnetId);
            const vnetCfg = await this.vnetManager.QueryConfig(vnetRef!);
            const space = new CIDRRange(vnetCfg.settings.addressSpace);
            if(space.Includes(address))
            {
                return {
                    type: "vnet",
                    vnetId
                };
            }
        }

        //everything else is assumed to be able to reach the host network
        return {
            type: "hosts-net",
        };
    }

    private async ForwardPacketToVNet(vnetId: number, trace: PacketTrace)
    {
        const vnetRef = await this.resourcesManager.CreateResourceReference(vnetId);

        trace.Trace("Packet trying to enter vnet: " + vnetRef!.externalId);

        const config = await this.vnetManager.QueryConfig(vnetRef!);
        return this.TryEnterFirewall(trace, config.inboundRules);
    }

    private async PacketLocationToString(location: PacketLocation)
    {
        switch(location.type)
        {
            case "host":
                return "on host " + await this.RequestHostName(location.hostId);
            case "hosts-net":
                return "on hosts network";
            case "vnet":
            {
                const ref = await this.resourcesManager.CreateResourceReference(location.vnetId);
                const cfg = await this.vnetManager.QueryConfig(ref!);

                return "on vnet " + cfg.settings.addressSpace;
            }
        }
    }

    private async RequestHostName(hostId: number)
    {
        const host = await this.hostsController.QueryHost(hostId);
        if(host === undefined)
            return "host not found. Should never happen";
        return host.hostName;
    }

    private async RoutePacket(trace: PacketTrace)
    {
        switch(trace.currentLocation.type)
        {
            case "host":
            {
                switch(trace.targetLocation.type)
                {
                    case "host":
                        if(trace.currentLocation.hostId === trace.targetLocation.hostId)
                            return this.SendPacketToHost(trace.targetLocation.hostId, trace);
                        return this.RoutePacketToHost(trace.targetLocation.hostId, trace);
                    case "hosts-net":
                        throw new Error("TODO impl7: " + trace.targetLocation.type);
                    case "vnet":
                        return this.RoutePacketOnHostToVNet(trace.currentLocation.hostId, trace);
                }
            }

            case "hosts-net":
            {
                switch(trace.targetLocation.type)
                {
                    case "host":
                        return this.RoutePacketToHost(trace.targetLocation.hostId, trace);
                    case "hosts-net":
                        throw new Error("TODO impl2: " + trace.targetLocation.type);
                    case "vnet":
                        throw new Error("TODO impl3: " + trace.targetLocation.type);
                }
            }

            case "vnet":
                throw new Error("TODO impl5: " + trace.currentLocation.type);
        }
    }

    private async RoutePacketOnHostToVNet(hostId: number, trace: PacketTrace)
    {
        const data = await this.hostNetworkInterfaceCardsManager.QueryAllNetworkInterfacesWithAddresses(hostId);
        for (const iface of data)
        {
            const ipv4 = iface.addr_info.find(x => x.family === "inet");
            if(ipv4 === undefined)
                continue;

            const ip = new IPv4(ipv4.local);
            const cidr = CIDRRange.FromIP(ip, ipv4.prefixlen);
            if(cidr.Includes(trace.targetAddress))
            {
                if(iface.ifname.startsWith("opc-virbr"))
                {
                    const vnetId = parseInt(iface.ifname.substring("opc-virbr".length));
                    return this.ForwardPacketToVNet(vnetId, trace);
                }
                else
                    throw new Error("TODO: not implemented");
            }
        }

        trace.Trace("No route found to deliver packet. Discarding it.");
    }

    private async RoutePacketToHost(hostId: number, trace: PacketTrace)
    {
        trace.Trace("Packet arrived on host: " + await this.RequestHostName(hostId));

        const zones = await this.hostFirewallZonesManager.QueryZones(hostId);
        const zone = zones.external;

        for(const rule of zone.portForwardingRules)
        {
            if((rule.protocol === trace.protocol) && (rule.port === trace.port))
            {
                trace.Trace("Packet is being DNATed to: " + rule.targetAddress + ":" + rule.targetPort);

                trace.UpdateLocation({
                    type: "host",
                    hostId
                });

                const targetIP = new IPv4(rule.targetAddress);
                trace.UpdateTarget(targetIP, rule.targetPort, await this.FindPacketLocation(targetIP));

                await this.RoutePacket(trace);
                return false;
            }
        }

        return this.SendPacketToHost(hostId, trace);
    }

    private async SendPacketToHost(hostId: number, trace: PacketTrace)
    {
        trace.Trace("Packet trying to enter zone: external");

        const zones = await this.hostFirewallZonesManager.QueryZones(hostId);
        const zone = zones.external;

        if(this.TryEnterFirewall(trace, zone.inboundRules))
        {
            trace.Trace("Packet successfully entered zone: external");
            trace.Trace("Packet successfully delivered to host");
        }
    }

    private TryEnterFirewall(trace: PacketTrace, rules: FirewallRule[])
    {
        for (const rule of rules)
        {
            const match = this.DoesFirewallRuleAllowPacket(trace, rule);
            if(match === "Allow")
            {
                trace.Trace("Packet was allowed by rule: " + rule.priority);
                return true;
            }
            else if(match === "Deny")
            {
                trace.Trace("Packet was blocked by rule: " + rule.priority);
                return false;
            }
        }

        trace.Trace("Packet was blocked by implicit deny rule");
        return false;
    }
}