/**
 * OpenPrivateCloud
 * Copyright (C) 2023-2025 Amir Czwink (amir130@hotmail.de)
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
import { HostNetworkInterfaceCardsManager } from "./HostNetworkInterfaceCardsManager";
import { ObjectExtensions, Observer, Subject } from "acts-util-core";
import { CIDRRange } from "../common/CIDRRange";

export interface FirewallRule
{
    priority: number;
    /**
     * A comma-separated list of port ranges or single ports.
     * For example: 80,443,8080-8088
     * The special value "Any" is also accepted.
     * @title Port(s)
     */
    destinationPortRanges: string;
    protocol: "Any" | "TCP" | "UDP" | "ICMP";
    /**
     * An IP address, a CIDR-range or the special keyword "Any".
     */
    source: string;
    /**
     * An IP address, a CIDR-range or the special keyword "Any".
     */
    destination: string;
    action: "Allow" | "Deny";
    comment: string;
}

export interface FirewallZone
{
    addressSpace: CIDRRange;
    name: string;
    interfaceNames: string[];
    inboundRules: FirewallRule[];
    outboundRules: FirewallRule[];
}

interface FirewallZoneCollection
{
    customZones: FirewallZone[];

    external: {
        interfaceNames: string[];
        inboundRules: FirewallRule[];
        outboundRules: FirewallRule[];
        portForwardingRules: PortForwardingRule[];
    };

    trusted: {
        interfaceNames: string[];
    };
}

export interface PortForwardingRule
{
    protocol: "TCP" | "UDP";
    port: number;
    targetAddress: string;
    targetPort: number;
    externalZoneOnly: boolean;
}

export interface FirewallZoneData
{
    addressSpace: CIDRRange;
    inboundRules: FirewallRule[];
    outboundRules: FirewallRule[];
    portForwardingRules: PortForwardingRule[];
}

export interface FirewallZoneDataProvider
{
    readonly matchingZonePrefix: string;
    MatchNetworkInterfaceName(nicName: string): string | null;
    ProvideData(hostId: number, zoneName: string): Promise<FirewallZoneData>;
}

@Injectable
export class HostFirewallZonesManager
{
    constructor(private hostNetworkInterfaceCardsManager: HostNetworkInterfaceCardsManager)
    {
        this._onChanges = new Subject<number>;
        this.dataProviders = [];
    }
    
    //Public methods
    public DetermineAssignedZoneForNetworkInterface(hostId: number, nicName: string)
    {
        if(nicName === "lo")
            return "trusted";
        if(nicName.startsWith("en") || nicName.startsWith("eth")) //ethernet
            return "external";
        if(nicName.startsWith("vnet"))
            return "qemu-vm-nic";
        if(nicName.startsWith("dh-"))
            return "docker-container-nic";
        if(nicName === "docker_gwbridge")
            return "docker_gwbridge";
        if(nicName === "docker0")
            return "docker0";

        if(nicName.startsWith("opc-"))
        {
            for (const dataProvider of this.dataProviders)
            {
                const zoneName = dataProvider.MatchNetworkInterfaceName(nicName);
                if(zoneName !== null)
                    return zoneName;
            }
        }
        if(nicName.startsWith("opcsip-"))
            return "container-static-ip";

        throw new Error("Unknown NIC type: " + nicName);
    }

    public async QueryZones(hostId: number): Promise<FirewallZoneCollection>
    {
        const nics = await this.hostNetworkInterfaceCardsManager.QueryAllNetworkInterfaces(hostId);
        const nicsAndZones = await nics.Values().Map(async x => ({
            interfaceName: x,
            zone: await this.DetermineAssignedZoneForNetworkInterface(hostId, x)
        })).PromiseAll();
        const zoneInterfaces = nicsAndZones.Values().GroupBy(x => x.zone).ToDictionary(kv => kv.key, kv => kv.value.map(x => x.interfaceName));

        const externalZoneData = await this.FetchZoneData(hostId, "external");

        const nonCustomZones = [
            //the standard zones that are always there
            "external", "trusted",
            //container or vm nics
            "docker-container-nic", "qemu-vm-nic",
            //docker
            "docker_gwbridge", "docker0"
        ];

        return {
            customZones: await ObjectExtensions.Entries(zoneInterfaces).Filter(kv => !nonCustomZones.includes(kv.key.toString())).Map(kv => this.BuildZoneData(hostId, kv.key.toString(), kv.value!)).PromiseAll(),

            external: {
                interfaceNames: zoneInterfaces["external"]!,
                inboundRules: externalZoneData.inboundRules,
                outboundRules: externalZoneData.outboundRules,
                portForwardingRules: externalZoneData.portForwardingRules,
            },
            trusted: {
                interfaceNames: zoneInterfaces["trusted"]!
            }
        };
    }

    public RegisterDataProvider(dataProvider: FirewallZoneDataProvider)
    {
        this.dataProviders.push(dataProvider);
    }

    public SubscribeForChanges(observer: Observer<number>)
    {
        this._onChanges.Subscribe(observer);
    }

    public ZoneDataChanged(hostId: number)
    {
        this._onChanges.Next(hostId);
    }

    //Private state
    private _onChanges: Subject<number>;
    private dataProviders: FirewallZoneDataProvider[];

    //Private methods
    private async BuildZoneData(hostId: number, zoneName: string, interfaceNames: string[]): Promise<FirewallZone>
    {
        const data = await this.FetchZoneData(hostId, zoneName);
        
        return {
            addressSpace: data.addressSpace,
            interfaceNames,
            name: zoneName,
            inboundRules: data.inboundRules,
            outboundRules: data.outboundRules
        };
    }

    private FetchZoneData(hostId: number, zoneName: string)
    {
        const provider = this.dataProviders.find(x => zoneName.startsWith(x.matchingZonePrefix));
        if(provider === undefined)
            throw new Error("Could not find zone '" + zoneName + "'. Known prefixes are: " + this.dataProviders.map(x => x.matchingZonePrefix).join(", "));
        return provider.ProvideData(hostId, zoneName);
    }
}