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
import { RemoteCommandExecutor } from "./RemoteCommandExecutor";
import { RemoteRootFileSystemManager } from "./RemoteRootFileSystemManager";
import { SystemServicesManager } from "./SystemServicesManager";

interface RuleConditionConnectionTrackOperand
{
    type: "ct";
    key: "state";
}

interface RuleConditionMetaOperand
{
    type: "meta";
    key: "iifname" | "l4proto" | "oifname";
}

interface RuleConditionPayloadOperand
{
    type: "payload";
    field: "daddr" | "dport" | "saddr" | "type";
    protocol?: "ether" | "ip" | "tcp" | "udp";
}

interface RuleConditionPrefixOperand
{
    type: "prefix";
    addr: string;
    len: number;
}

interface RuleConditionRangeOperand
{
    type: "range";
    range: number[];
}

interface RuleConditionValueOperand
{
    type: "value";
    value: string;
}

interface RuleConditionValueListOperand
{
    type: "values";
    values: string[];
}

export type NetfilteRuleConditionOperand = RuleConditionConnectionTrackOperand | RuleConditionMetaOperand | RuleConditionPayloadOperand | RuleConditionPrefixOperand | RuleConditionRangeOperand | RuleConditionValueOperand | RuleConditionValueListOperand;

export interface NetfilterRuleCondition
{
    op: "==" | "!=" | "in";
    left: NetfilteRuleConditionOperand;
    right: NetfilteRuleConditionOperand;
}

interface RuleCounter
{
    packets: number;
    bytes: number;
}

interface RulePolicyAction
{
    type: "accept" | "drop" | "masquerade" | "return";
}

interface RulePolicyDestinationNAT
{
    type: "dnat";
    addr: string;
    port: number;
}

interface RulePolicyJump
{
    type: "jump";
    target: string;
}

interface RulePolicyMangle
{
    type: "mangle";
    key: {
        meta: {
            key: "nftrace";
        };
    };
    value: 1;
}

interface RulePolicyRejection
{
    type: "reject";
    expr: "port-unreachable";
}

type RulePolicy = RulePolicyAction | RulePolicyDestinationNAT | RulePolicyJump | RulePolicyMangle | RulePolicyRejection;

export interface NetfilterRuleCreationData
{
    conditions: NetfilterRuleCondition[];
    policy?: RulePolicy;
}

export interface NetfilterRule extends NetfilterRuleCreationData
{
    counter: RuleCounter;
    handle: number;
}

export interface NetfilterChain<RuleType>
{
    name: string;
    rules: RuleType[];
    type?: "filter" | "nat";
    hook?: "forward" | "input" | "output" | "postrouting" | "prerouting";
    prio?: number | "dstnat" | "filter" | "srcnat";
    policy?: "accept" | "drop";
}

interface Table<RuleType>
{
    name: string;
    family: "bridge" | "ip" | "ip6";
    chains: NetfilterChain<RuleType>[];
}

@Injectable
export class HostNetfilterService
{
    constructor(private remoteCommandExecutor: RemoteCommandExecutor, private remoteRootFileSystemManager: RemoteRootFileSystemManager, private systemServicesManager: SystemServicesManager)
    {
    }

    //Public methods
    public async ReadActiveRuleSet(hostId: number)
    {
        const result = await this.ReadNFTables(hostId);
        return result;
    }

    public async ReadNetfilterVersion(hostId: number)
    {
        const result = await this.remoteCommandExecutor.ExecuteBufferedCommand(["/usr/sbin/nft", "-v"], hostId);
        const parts = result.stdOut.split(" ");
        const versionPart = parts[1].substring(1);
        return versionPart.split(".").map(x => parseInt(x));
    }

    public async WriteRuleSet(hostId: number, tables: Table<NetfilterRuleCreationData>[])
    {
        const writtenTables = tables.map(this.TableToNFTSourceCode.bind(this));

        const textContent = "#!/usr/sbin/nft -f\n\nflush ruleset\n\n" + writtenTables.join("\n\n");
        await this.remoteRootFileSystemManager.WriteTextFile(hostId, "/etc/nftables.conf", textContent);

        const enabled = await this.systemServicesManager.IsServiceEnabled(hostId, "nftables");
        if(!enabled)
            await this.systemServicesManager.EnableService(hostId, "nftables");
        await this.systemServicesManager.RestartService(hostId, "nftables");
    }

    //Private methods
    private ChainToNFTSourceCode(chain: NetfilterChain<NetfilterRuleCreationData>)
    {
        const policyPart = (chain.policy === undefined) ? "" : " policy " + chain.policy + ";";
        const type = (chain.type === undefined) ? "" : (`type ${chain.type} hook ${chain.hook} priority ${chain.prio};` + policyPart);
        const typeIfExists = (type === "") ? "" : ("\t\t" + type + "\n");

        const rules = chain.rules.Values().Map(x => "\t\t" + this.RuleToNFTSourceCode(x)).Join("\n");

        return "\tchain " + chain.name + " {\n" + typeIfExists + rules + "\n\t}";
    }

    private ConditionToNFTSourceCode(condition: NetfilterRuleCondition)
    {
        const left = this.OperandToNFTSourceCode(condition.left);
        const right = this.OperandToNFTSourceCode(condition.right);
        const op = (condition.op === "!=") ? condition.op : undefined;

        return [left, op, right].filter(x => x !== undefined).join(" ");
    }

    private ConvertMatch(match: any): NetfilterRuleCondition
    {
        return {
            op: match.op,
            left: this.ConvertOperand(match.left),
            right: this.ConvertOperand(match.right)
        };
    }

    private ConvertOperand(op: any): NetfilteRuleConditionOperand
    {
        if(typeof op === "string")
        {
            return {
                type: "value",
                value: op
            };
        }
        else if("meta" in op)
        {
            return {
                type: "meta",
                key: op.meta.key
            };
        }
        else if("payload" in op)
        {
            return {
                type: "payload",
                field: op.payload.field
            };
        }
        else if("prefix" in op)
        {
            return {
                addr: op.prefix.addr,
                len: op.prefix.len,
                type: "prefix"
            };
        }
        console.log(op);
        throw new Error("Not implemented");
    }

    private ConvertRule(rule: any): NetfilterRule
    {
        let counter: RuleCounter = { bytes: 0, packets: 0 };
        const conditions: NetfilterRuleCondition[] = [];
        let policy: RulePolicy | undefined;

        for (const entry of rule.expr)
        {
            if("accept" in entry)
                policy = { type: "accept" };
            else if("counter" in entry)
                counter = entry.counter;
            else if("drop" in entry)
                policy = { type: "drop" };
            else if("jump" in entry)
            {
                policy = {
                    type: "jump",
                    target: entry.jump.target
                };
            }
            else if("masquerade" in entry)
                policy = { type: "masquerade" };
            else if("match" in entry)
                conditions.push(this.ConvertMatch(entry.match));
            else if("return" in entry)
                policy = { type: "return" };
            else if("xt" in entry)
                continue; //xtables data
            else
                console.log(entry);
        }

        return {
            conditions,
            counter,
            handle: rule.handle,
            policy
        };
    }
    private OperandToNFTSourceCode(operand: NetfilteRuleConditionOperand)
    {
        switch(operand.type)
        {
            case "ct":
                return ["ct", operand.key].join(" ");
            case "meta":
                return ["meta", operand.key].join(" ");
            case "payload":
                return [operand.protocol, operand.field].filter(x => x !== undefined).join(" ");
            case "prefix":
                return [operand.addr + "/" + operand.len];
            case "range":
                return [operand.range[0] + "-" + operand.range[1]];
            case "value":
                return operand.value;
            case "values":
                return operand.values.join(",");
        }
    }

    private PolicyToNFTSourceCode(policy: RulePolicy)
    {
        if(policy.type === "dnat")
            return "dnat to " + policy.addr + ":" + policy.port;
        if(policy.type === "jump")
            return "jump " + policy.target;
        if(policy.type === "reject")
            return "reject with icmp type " + policy.expr;
        if(policy.type === "mangle")
            return "meta " + policy.key.meta.key + " set " + policy.value;
        return policy.type;
    }

    private async ReadNFTables(hostId: number)
    {
        const result = await this.remoteCommandExecutor.ExecuteBufferedCommand(["sudo", "nft", "-j", "list", "ruleset"], hostId);
        const data = JSON.parse(result.stdOut).nftables;

        const tables: Table<NetfilterRule>[] = [];
        for (const entry of data)
        {
            if("table" in entry)
            {
                tables.push({
                    name: entry.table.name,
                    chains: [],
                    family: entry.table.family
                });
            }
            else if("chain" in entry)
            {
                const table = tables.find(x => (x.family === entry.chain.family) && (x.name === entry.chain.table))!;
                table.chains.push({
                    name: entry.chain.name,
                    policy: entry.chain.policy,
                    rules: [],
                    hook: entry.chain.hook,
                    prio: entry.chain.prio,
                    type: entry.chain.type
                });
            }
            else if("rule" in entry)
            {
                const table = tables.find(x => (x.family === entry.rule.family) && (x.name === entry.rule.table))!;
                const chain = table.chains.find(x => (x.name === entry.rule.chain));
                chain!.rules.push(this.ConvertRule(entry.rule));
            }
        }

        return tables;
    }

    private RuleToNFTSourceCode(rule: NetfilterRuleCreationData)
    {
        const conds = rule.conditions.Values().Map(this.ConditionToNFTSourceCode.bind(this)).Join(" ");
        const policy = (rule.policy === undefined) ? "" : this.PolicyToNFTSourceCode(rule.policy);

        if(conds.length === 0)
            return policy;
        return conds + " " + policy;
    }

    private TableToNFTSourceCode(table: Table<NetfilterRuleCreationData>)
    {
        const chains = table.chains.Values().Map(this.ChainToNFTSourceCode.bind(this)).Join("\n");
        return `table ${table.family} ${table.name} {` + "\n" + chains + "\n}";
    }
}