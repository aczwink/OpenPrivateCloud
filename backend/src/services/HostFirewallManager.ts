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

import { Injectable } from "acts-util-node";
import { HostNetfilterService, NetfilterChain, NetfilterRuleCondition, NetfilterRuleCreationData } from "./HostNetfilterService";
import { FirewallRule, FirewallZone, HostFirewallZonesManager, PortForwardingRule } from "./HostFirewallZonesManager";
import { HostNetworkInterfaceCardsManager } from "./HostNetworkInterfaceCardsManager";
import { CIDRRange } from "../common/CIDRRange";
import { IPv4 } from "../common/IPv4";


interface FlatFirewallRule
{
    portRange?: { from: number; to: number; };
    sourceAddressRange?: string;
    destinationAddressRange?: string;
    protocol: "TCP" | "UDP" | "ICMP";
    action: "Allow" | "Deny";
}

@Injectable
export class HostFirewallManager
{
    constructor(private hostNetFilterService: HostNetfilterService, private hostFirewallZonesManager: HostFirewallZonesManager, private hostNetworkInterfaceCardsManager: HostNetworkInterfaceCardsManager)
    {
        this.hostFirewallZonesManager.SubscribeForChanges({
            next: this.ApplyRuleSet.bind(this)
        });
    }

    //Public methods
    public async ApplyRuleSet(hostId: number)
    {
        const externalNIC = await this.hostNetworkInterfaceCardsManager.FindExternalNetworkInterface(hostId);
        const isTracingEnabled = false; //monitor with: "nft monitor trace"
        const zones = await this.hostFirewallZonesManager.QueryZones(hostId);

        const externalZoneInputChainName = "ENTER_zone_external";
        const externalZoneOutputChainName = "EXIT_zone_external";

        await this.hostNetFilterService.WriteRuleSet(hostId, [
            {
                name: "opc_filter",
                family: "bridge",
                chains: [
                    ...zones.customZones.Values().Map(this.CreateCustomZoneBridgeFilterChain.bind(this, isTracingEnabled)).ToArray(),
                    {
                        name: "FORWARD",
                        rules: [
                            {
                                //accept traffic originated from us
                                conditions: [
                                    {
                                        left: {
                                            type: "ct",
                                            key: "state",
                                        },
                                        op: "in",
                                        right: {
                                            type: "values",
                                            values: ["established", "related"]
                                        }
                                    }
                                ],
                                policy: { type: "accept" },
                            },
                            {
                                //allow arp
                                conditions: [
                                    {
                                        op: "==",
                                        left: {
                                            type: "payload",
                                            field: "type",
                                            protocol: "ether",
                                        },
                                        right: {
                                            type: "value",
                                            value: "arp"
                                        }
                                    },
                                ],
                                policy: { type: "accept" }
                            },
                            ...zones.customZones.Values().Map(this.CreateCustomZoneBridgeFilterJumpRule.bind(this)).ToArray(),
                            ...this.AddTracingRule(isTracingEnabled),
                        ],
                        hook: "forward",
                        policy: "drop",
                        prio: "filter",
                        type: "filter"
                    }
                ]
            },
            {
                name: "opc_filter",
                family: "ip",
                chains: [
                    //EXTERNAL ZONE
                    {
                        name: externalZoneInputChainName,
                        rules: [
                            ...this.CreateNetFilterRules(zones.external.inboundRules),
                            ...this.AddTracingRule(isTracingEnabled),
                        ]
                    },
                    {
                        name: externalZoneOutputChainName,
                        rules: [
                            ...this.CreateNetFilterRules(zones.external.outboundRules),
                            ...this.AddTracingRule(isTracingEnabled),
                            {
                                //the default for the external zone is to accept
                                conditions: [],
                                policy: { type: "accept" }
                            }
                        ]
                    },

                    //CUSTOM ZONES
                    ...zones.customZones.Values().Map(this.CreateCustomZoneChains.bind(this, isTracingEnabled)).Map(x => x.Values()).Flatten().ToArray(),

                    //Hooks
                    {
                        name: "INPUT",
                        rules: [
                            {
                                //drop invalid traffic
                                conditions: [
                                    {
                                        op: "==",
                                        left: {
                                            type: "ct",
                                            key: "state"
                                        },
                                        right: {
                                            type: "value",
                                            value: "invalid"
                                        }
                                    }
                                ],
                                policy: { type: "drop" }
                            },
                            {
                                //accept traffic originated from us
                                conditions: [
                                    {
                                        left: {
                                            type: "ct",
                                            key: "state",
                                        },
                                        op: "in",
                                        right: {
                                            type: "values",
                                            values: ["established", "related"]
                                        }
                                    }
                                ],
                                policy: { type: "accept" },
                            },
                            ...zones.trusted.interfaceNames.map(this.CreateTrustedZoneInputRule.bind(this)),
                            ...zones.external.interfaceNames.map(x => this.CreateInputJumpRule(x, externalZoneInputChainName) ),
                            ...zones.customZones.Values().Map(x => x.interfaceNames.map(y => this.CreateInputJumpRule(y, this.CreateCustomZoneChainName("OUTPUT", x.name))).Values()).Flatten().ToArray(),
                            ...this.AddTracingRule(isTracingEnabled),
                            {
                                conditions: [],
                                policy: { type: "reject", expr: "port-unreachable" }
                            }
                        ],
                        hook: "input",
                        policy: "drop", //default is to drop anything that doesn't pass other rules
                        prio: "filter",
                        type: "filter"
                    },
                    {
                        name: "FORWARD",
                        rules: [
                            ...zones.external.portForwardingRules.map(this.GenerateIncomingDestinationNAT_ForwardRule.bind(this, externalNIC, zones.customZones)),
                            ...zones.customZones.Values().Map(x => x.interfaceNames.map(y => this.CreateInboundForwardRule(y, x.addressSpace, x.name)).Values()).Flatten().ToArray(),
                            ...zones.customZones.Values().Map(x => x.interfaceNames.map(y => this.CreateOutboundForwardRule(y, x.addressSpace, x.name)).Values()).Flatten().ToArray(),
                            ...this.AddTracingRule(isTracingEnabled),
                        ],
                        hook: "forward",
                        policy: "drop",
                        prio: "filter",
                        type: "filter"
                    },
                    {
                        name: "OUTPUT",
                        rules: [
                            ...zones.trusted.interfaceNames.map(this.CreateTrustedZoneOutputRule.bind(this)),
                            ...zones.external.interfaceNames.map(x => this.CreateOutputJumpRule(x, externalZoneOutputChainName) ),
                            ...zones.customZones.Values().Map(x => x.interfaceNames.map(y => this.CreateOutputJumpRule(y, this.CreateCustomZoneChainName("INPUT", x.name))).Values()).Flatten().ToArray(),
                            ...this.AddTracingRule(isTracingEnabled),
                        ],
                        hook: "output",
                        policy: "drop", //default is to drop anything that doesn't pass other rules
                        prio: "filter",
                        type: "filter"
                    }
                ]
            },
            {
                name: "opc_nat",
                family: "ip",
                chains: [
                    {
                        name: "PREROUTING",
                        rules: [
                            ...zones.external.portForwardingRules.map(this.GenerateDestinationNAT_Rule.bind(this, externalNIC))
                        ],
                        hook: "prerouting",
                        prio: "dstnat",
                        type: "nat"
                    },
                    {
                        name: "POSTROUTING",
                        rules: [
                            ...zones.customZones.map(this.GenerateSourceNAT_Rule.bind(this, externalNIC)),
                        ],
                        hook: "postrouting",
                        prio: "srcnat",
                        type: "nat"
                    }
                ]
            },
            //IPv6 is not supported and all traffic is dropped
            {
                name: "opc_filter",
                family: "ip6",
                chains: [
                    {
                        name: "INPUT",
                        rules: [],
                        hook: "input",
                        policy: "drop",
                        prio: "filter",
                        type: "filter"
                    },
                    {
                        name: "FORWARD",
                        rules: [],
                        hook: "forward",
                        policy: "drop",
                        prio: "filter",
                        type: "filter"
                    },
                    {
                        name: "OUTPUT",
                        rules: [],
                        hook: "output",
                        policy: "drop",
                        prio: "filter",
                        type: "filter"
                    }
                ]
            },
        ])
    }

    //Private methods
    private AddTracingRule(isTracingEnabled: boolean): NetfilterRuleCreationData[]
    {
        if(!isTracingEnabled)
            return [];
        return [
            {
                conditions: [],
                policy: {
                    type: "mangle",
                    key: {
                        meta: {
                            key: "nftrace"
                        }
                    },
                    value: 1
                }
            }
        ];
    }

    private ConvertToNetFilterRule(rule: FlatFirewallRule): NetfilterRuleCreationData
    {
        const conditions: NetfilterRuleCondition[] = [];

        if(rule.protocol === "ICMP")
        {
            conditions.push({
                op: "==",
                left: {
                    type: "meta",
                    key: "l4proto"
                },
                right: {
                    type: "value",
                    value: "icmp"
                }
            });
        }

        if(rule.portRange !== undefined)
        {
            if(rule.portRange.from !== rule.portRange.to)
                throw new Error("implement range");

            conditions.push({
                op: "==",
                left: {
                    type: "payload",
                    field: "dport",
                    protocol: rule.protocol.toLowerCase() as any,
                },
                right: {
                    type: "value",
                    value: rule.portRange.from.toString()
                }
            });
        }

        if(rule.sourceAddressRange !== undefined)
        {
            const parts = rule.sourceAddressRange.split("/");
            conditions.push({
                op: "==",
                left: {
                    type: "payload",
                    field: "saddr",
                    protocol: "ip"
                },
                right: {
                    type: "prefix",
                    addr: parts[0],
                    len: parseInt(parts[1])
                }
            });
        }

        if(rule.destinationAddressRange !== undefined)
        {
            const parts = rule.destinationAddressRange.split("/");
            conditions.push({
                op: "==",
                left: {
                    type: "payload",
                    field: "daddr",
                    protocol: "ip"
                },
                right: {
                    type: "prefix",
                    addr: parts[0],
                    len: parseInt(parts[1])
                }
            });
        }

        return {
            conditions,
            policy: { type: (rule.action === "Allow") ? "accept" : "drop" }
        };
    }

    private CreateCrossJumpRule(interfaceName: string): NetfilterRuleCreationData
    {
        return {
            conditions: [
                {
                    left: {
                        type: "meta",
                        key: "iifname",
                    },
                    op: "==",
                    right: {
                        type: "value",
                        value: interfaceName
                    }
                },
                {
                    left: {
                        type: "meta",
                        key: "oifname",
                    },
                    op: "==",
                    right: {
                        type: "value",
                        value: interfaceName
                    }
                }
            ],
            policy: { type: "accept" }
        };
    }

    private CreateCustomZoneBridgeFilterChain(isTracingEnabled: boolean, customZone: FirewallZone): NetfilterChain<NetfilterRuleCreationData>
    {
        return {
            name: "zone_" + customZone.name.ReplaceAll("-", "_"),
            rules: [
                ...this.CreateNetFilterRules(customZone.outboundRules),
                ...this.CreateNetFilterRules(customZone.inboundRules),
                ...this.AddTracingRule(isTracingEnabled),
            ]
        };
    }

    private CreateCustomZoneBridgeFilterJumpRule(customZone: FirewallZone): NetfilterRuleCreationData
    {
        return {
            conditions: [
                {
                    left: {
                        type: "payload",
                        field: "saddr",
                        protocol: "ip",
                    },
                    op: "==",
                    right: {
                        type: "prefix",
                        addr: customZone.addressSpace.netAddress.ToString(),
                        len: customZone.addressSpace.length
                    }
                },
                {
                    left: {
                        type: "payload",
                        field: "daddr",
                        protocol: "ip",
                    },
                    op: "==",
                    right: {
                        type: "prefix",
                        addr: customZone.addressSpace.netAddress.ToString(),
                        len: customZone.addressSpace.length
                    }
                }
            ],
            policy: { type: "jump", target: "zone_" + customZone.name.ReplaceAll("-", "_") }
        };
    }

    private CreateCustomZoneChainName(type: "INPUT" | "OUTPUT", customZoneName: string)
    {
        const mapped = (type === "INPUT") ? "ENTER" : "EXIT";
        return mapped + "_zone_" + customZoneName.ReplaceAll("-", "_");
    }

    private CreateCustomZoneChains(isTracingEnabled: boolean, customZone: FirewallZone): NetfilterChain<NetfilterRuleCreationData>[]
    {
        return [
            {
                name: this.CreateCustomZoneChainName("INPUT", customZone.name),
                rules: [
                    ...this.CreateNetFilterRules(customZone.inboundRules),
                    ...this.AddTracingRule(isTracingEnabled),
                ],
            },
            {
                name: this.CreateCustomZoneChainName("OUTPUT", customZone.name),
                rules: [
                    ...this.CreateNetFilterRules(customZone.outboundRules),
                    {
                        //accept all traffic that goes into custom zones, since these are internal networks of the host
                        conditions: [],
                        policy: { type: "accept" }
                    },
                    ...this.AddTracingRule(isTracingEnabled),
                ]
            },
        ];
    }

    private CreateInboundForwardRule(outputInterfaceName: string, destinationAddressRange: CIDRRange, customZoneName: string): NetfilterRuleCreationData
    {
        return {
            //accept traffic for our subnet but only if it originated from us
            conditions: [
                {
                    op: "==",
                    left: {
                        type: "meta",
                        key: "oifname",
                    },
                    right: {
                        type: "value",
                        value: outputInterfaceName
                    }
                },
                {
                    op: "==",
                    left: {
                        type: "payload",
                        field: "daddr",
                        protocol: "ip",
                    },
                    right: {
                        type: "prefix",
                        addr: destinationAddressRange.netAddress.ToString(),
                        len: destinationAddressRange.length
                    }
                },
                {
                    left: {
                        type: "ct",
                        key: "state",
                    },
                    op: "in",
                    right: {
                        type: "values",
                        values: ["established", "related"]
                    }
                }
            ],
            policy: { type: "accept" }
        };
    }

    private CreateInputJumpRule(interfaceName: string, chainName: string): NetfilterRuleCreationData
    {
        //we are getting a packet coming from that interface
        return {
            conditions: [
                {
                    left: {
                        type: "meta",
                        key: "iifname",
                    },
                    op: "==",
                    right: {
                        type: "value",
                        value: interfaceName
                    }
                }
            ],
            policy: { type: "jump", target: chainName }
        };
    }

    private CreateNetFilterRules(rules: FirewallRule[])
    {
        return rules.Values()
            .Map(this.FlattenFirewallRule.bind(this))
            .Map(x => x.Values())
            .Flatten()
            .Map(this.ConvertToNetFilterRule.bind(this));
    }

    private CreateOutboundForwardRule(inputInterfaceName: string, sourceAddressRange: CIDRRange, customZoneName: string): NetfilterRuleCreationData
    {
        return {
            conditions: [
                {
                    op: "==",
                    left: {
                        type: "meta",
                        key: "iifname",
                    },
                    right: {
                        type: "value",
                        value: inputInterfaceName
                    }
                },
                {
                    op: "==",
                    left: {
                        type: "payload",
                        field: "saddr",
                        protocol: "ip",
                    },
                    right: {
                        type: "prefix",
                        addr: sourceAddressRange.netAddress.ToString(),
                        len: sourceAddressRange.length
                    }
                }
            ],
            policy: { type: "jump", target: this.CreateCustomZoneChainName("OUTPUT", customZoneName) }
        };
    }

    private CreateOutputJumpRule(interfaceName: string, chainName: string): NetfilterRuleCreationData
    {
        //we are generating a packet out of that interface
        return {
            conditions: [
                {
                    left: {
                        type: "meta",
                        key: "oifname",
                    },
                    op: "==",
                    right: {
                        type: "value",
                        value: interfaceName
                    }
                }
            ],
            policy: { type: "jump", target: chainName }
        };
    }

    private CreateTrustedZoneInputRule(interfaceName: string): NetfilterRuleCreationData
    {
        return {
            //accept any traffic coming from an interface associated with the trusted zone (i.e. "lo" for localhost traffic)
            conditions: [
                {
                    left: {
                        type: "meta",
                        key: "iifname",
                    },
                    op: "==",
                    right: {
                        type: "value",
                        value: interfaceName
                    }
                }
            ],
            policy: { type: "accept" },
        };
    }

    private CreateTrustedZoneOutputRule(interfaceName: string): NetfilterRuleCreationData
    {
        return {
            //accept any traffic going out of an interface associated with the trusted zone (i.e. "lo" for localhost traffic)
            conditions: [
                {
                    left: {
                        type: "meta",
                        key: "oifname",
                    },
                    op: "==",
                    right: {
                        type: "value",
                        value: interfaceName
                    }
                }
            ],
            policy: { type: "accept" },
        };
    }

    private FlattenFirewallRule(rule: FirewallRule): FlatFirewallRule[]
    {
        const result: FlatFirewallRule[] = [];

        const portParts = rule.destinationPortRanges.split(",");
        const sourceParts = rule.source.split(",");
        const destinationParts = rule.destination.split(",");

        for (const portPart of portParts)
        {
            const portParts = portPart.split("-");
            const from = parseInt(portParts[0]);
            const to = (portParts.length === 2) ? parseInt(portParts[1]) : from;
            const portRange = (portPart === "Any") ? undefined : { from, to };

            for (const sourcePart of sourceParts)
            {
                for (const destinationPart of destinationParts)
                {
                    let protos: ("TCP" | "UDP" | "ICMP")[];
                    if(rule.protocol === "Any")
                    {
                        if(portRange === undefined)
                            protos = ["TCP", "UDP", "ICMP"];
                        else
                            protos = ["TCP", "UDP"];
                    }
                    else
                        protos = [rule.protocol];

                    for (const proto of protos)
                    {
                        result.push({
                            action: rule.action,
                            portRange,
                            protocol: proto,
                            destinationAddressRange: (destinationPart === "Any") ? undefined : destinationPart,
                            sourceAddressRange: (sourcePart === "Any") ? undefined : sourcePart,
                        });
                    }
                }
            }
        }

        return result;
    }

    private GenerateDestinationNAT_Rule(externalNIC: string, portForwardingRule: PortForwardingRule): NetfilterRuleCreationData
    {
        return {
            conditions: [
                {
                    op: "==",
                    left: {
                        type: "meta",
                        key: "iifname"
                    },
                    right: {
                        type: "value",
                        value: externalNIC
                    }
                },
                {
                    op: "==",
                    left: {
                        type: "payload",
                        protocol: portForwardingRule.protocol.toLowerCase() as any,
                        field: "dport"
                    },
                    right: {
                        type: "value",
                        value: portForwardingRule.port.toString()
                    }
                }
            ],
            policy: {
                type: "dnat",
                addr: portForwardingRule.targetAddress,
                port: portForwardingRule.targetPort
            }
        };
    }

    private GenerateIncomingDestinationNAT_ForwardRule(externalNIC: string, zones: FirewallZone[], portForwardingRule: PortForwardingRule): NetfilterRuleCreationData
    {
        const targetAddr = new IPv4(portForwardingRule.targetAddress);
        const targetZone = zones.find(x => x.addressSpace.Includes(targetAddr))!;

        return {
            conditions: [
                {
                    op: "==",
                    left: {
                        type: "meta",
                        key: "iifname"
                    },
                    right: {
                        type: "value",
                        value: externalNIC
                    }
                },
                {
                    op: "==",
                    left: {
                        type: "meta",
                        key: "oifname"
                    },
                    right: {
                        type: "values",
                        values: targetZone.interfaceNames
                    }
                },
                {
                    op: "==",
                    left: {
                        type: "payload",
                        field: "daddr",
                        protocol: "ip"
                    },
                    right: {
                        type: "value",
                        value: portForwardingRule.targetAddress
                    }
                },
                {
                    op: "==",
                    left: {
                        type: "payload",
                        field: "dport",
                        protocol: portForwardingRule.protocol.toLowerCase() as any
                    },
                    right: {
                        type: "value",
                        value: portForwardingRule.targetPort.toString()
                    }
                },
                {
                    left: {
                        type: "ct",
                        key: "state",
                    },
                    op: "in",
                    right: {
                        type: "value",
                        value: "new"
                    }
                }
            ],
            policy: { type: "jump", target: this.CreateCustomZoneChainName("INPUT", targetZone.name) }
        };
    }

    private GenerateSourceNAT_Rule(externalNIC: string, config: FirewallZone): NetfilterRuleCreationData
    {
        //replace the source address with the one of the external interface for all packes leaving that interface
        
        return {
            conditions: [
                {
                    op: "==",
                    left: {
                        type: "meta",
                        key: "oifname"
                    },
                    right: {
                        type: "value",
                        value: externalNIC
                    }
                },
                {
                    op: "==",
                    left: {
                        type: "payload",
                        protocol: "ip",
                        field: "saddr"
                    },
                    right: {
                        type: "prefix",
                        addr: config.addressSpace.netAddress.ToString(),
                        len: config.addressSpace.length
                    }
                }
            ],
            policy: {
                type: "masquerade"
            }
        };
    }
}