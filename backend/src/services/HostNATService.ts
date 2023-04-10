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
//import { HostConfigController } from "../data-access/HostConfigController";
import { HostMetricsService } from "./HostMetricsService";
import { HostNetfilterService, NetfilterRule, NetfilterRuleCreationData, NetfilteRuleConditionOperand } from "./HostNetfilterService";

interface SNATEntry
{
    sourceRange: string;
}

@Injectable
export class HostNATService
{
    constructor(/*private hostConfigController: HostConfigController, */private hostNetfilterService: HostNetfilterService, private hostMetricsService: HostMetricsService)
    {
    }

    //Public methods
    public async AddSourceNATRule(hostId: number, cidrRange: string)
    {
        /*const entries = await this.QuerySNATConfig(hostId);
        entries.push({ sourceRange: cidrRange });
        await this.UpdateSNATConfig(hostId, entries);*/

        const networkInterface = await this.FindExternalNetworkInterface(hostId);
        await this.hostNetfilterService.AddTemporaryNATRule(hostId, "ip", "opc_nat", "POSTROUTING", this.GenerateSNATRule(networkInterface, cidrRange));

        await this.UpdatePermanentHostRuleSet(hostId);
    }

    public async RemoveSourceNATRule(hostId: number, cidrRange: string)
    {
        /*const entries = await this.QuerySNATConfig(hostId);
        const index = entries.findIndex(x => x.sourceRange === cidrRange);
        entries.Remove(index);
        await this.UpdateSNATConfig(hostId, entries);*/

        const active = (await this.hostNetfilterService.ReadActiveRuleSet(hostId));
        const table = active.find(x => x.name === "opc_nat");
        const chain = table?.chains.find(x => x.name === "POSTROUTING");
        if(chain !== undefined)
        {
            const cidr = new CIDRRange(cidrRange);
            const found = chain.rules.find(this.FindMatchingSNATRule.bind(this, cidr));

            if(found !== undefined)
                await this.hostNetfilterService.DeleteNATRuleTemporarily(hostId, "ip", "opc_nat", "POSTROUTING", found.handle);
        }

        await this.UpdatePermanentHostRuleSet(hostId);
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

    /*private async QuerySNATConfig(hostId: number)
    {
        const config = await this.hostConfigController.QueryConfig<SNATEntry[]>(hostId, "SNAT");
        if(config === undefined)
            return [];
        return config;
    }

    private async UpdateSNATConfig(hostId: number, entries: SNATEntry[])
    {
        await this.hostConfigController.UpdateOrInsertConfig(hostId, "SNAT", entries);
    }*/

    private async UpdatePermanentHostRuleSet(hostId: number)
    {
        //const entries = await this.QuerySNATConfig(hostId);

        const networkInterface = await this.FindExternalNetworkInterface(hostId);
        
        await this.hostNetfilterService.UpdatePermanentRules(hostId);
        /*
        [
            {
                name: "POSTROUTING",
                rules: entries.map(x => this.GenerateSNATRule(networkInterface, x.sourceRange))
            }
        ]
        */
    }
}