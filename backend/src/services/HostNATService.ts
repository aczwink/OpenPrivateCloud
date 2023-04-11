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
import { CIDRRange } from "../common/CIDRRange";
import { HostMetricsService } from "./HostMetricsService";
import { HostNetfilterService, NetfilterRule, NetfilterRuleCreationData, NetfilteRuleConditionOperand } from "./HostNetfilterService";

@Injectable
export class HostNATService
{
    constructor(private hostNetfilterService: HostNetfilterService, private hostMetricsService: HostMetricsService)
    {
    }

    //Public methods
    public async AddSourceNATRule(hostId: number, cidrRange: string)
    {
        const ruleSet = await this.hostNetfilterService.ReadActiveRuleSet(hostId);
        const table = ruleSet.find(x => x.name === "opc_nat");
        if(table === undefined)
            await this.hostNetfilterService.AddTable(hostId, "ip", "opc_nat");
        const chain = table?.chains.find(x => x.name === "POSTROUTING");
        if(chain === undefined)
            await this.hostNetfilterService.AddChain(hostId, "ip", "opc_nat", { hook: "postrouting", name: "POSTROUTING", policy: "accept", priority: "srcnat", type: "nat" });

        const networkInterface = await this.FindExternalNetworkInterface(hostId);
        await this.hostNetfilterService.AddNATRule(hostId, "ip", "opc_nat", "POSTROUTING", this.GenerateSNATRule(networkInterface, cidrRange));
    }

    public async RemoveSourceNATRule(hostId: number, cidrRange: string)
    {
        const active = (await this.hostNetfilterService.ReadActiveRuleSet(hostId));
        const table = active.find(x => x.name === "opc_nat");
        const chain = table?.chains.find(x => x.name === "POSTROUTING");
        if(chain !== undefined)
        {
            const cidr = new CIDRRange(cidrRange);
            const found = chain.rules.find(this.FindMatchingSNATRule.bind(this, cidr));

            if(found !== undefined)
                await this.hostNetfilterService.DeleteNATRule(hostId, "ip", "opc_nat", "POSTROUTING", found.handle);
        }
    }

    //Private methods
    private async FindExternalNetworkInterface(hostId: number)
    {
        const stats = await this.hostMetricsService.ReadNetworkStatistics(hostId);
        const filtered = stats.filter(x => x.interfaceName.startsWith("e"));
        if(filtered.length != 1)
            throw new Error("Method not implemented.");
        return filtered[0].interfaceName;
    }

    private FindMatchingSNATRule(cidrRange: CIDRRange, rule: NetfilterRule)
    {
        function IsPrefix(op: NetfilteRuleConditionOperand)
        {
            if(op.type === "prefix")
            {
                if( (op.addr === cidrRange.netAddress) && (op.len === cidrRange.length) )
                    return true;
            }
            return false;
        }

        for (const cond of rule.conditions)
        {
            if( (cond.op === "==") && (IsPrefix(cond.left) || IsPrefix(cond.right)))
                return true;
        }
        return false;
    }

    private GenerateSNATRule(networkInterface: string, cidrRange: string): NetfilterRuleCreationData
    {
        const rangeParts = cidrRange.split("/");
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
                        value: networkInterface
                    }
                },
                {
                    op: "==",
                    left: {
                        type: "payload",
                        field: "saddr"
                    },
                    right: {
                        type: "prefix",
                        addr: rangeParts[0],
                        len: parseInt(rangeParts[1])
                    }
                }
            ],
            policy: {
                type: "masquerade"
            }
        };
    }
}