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

interface RuleConditionMetaOperand
{
    type: "meta";
    key: "l4proto" | "oifname";
}

interface RuleConditionPayloadOperand
{
    type: "payload";
    field: "saddr";
}

interface RuleConditionPrefixOperand
{
    type: "prefix";
    addr: string;
    len: number;
}

interface RuleConditionValueOperand
{
    type: "value";
    value: string;
}

export type NetfilteRuleConditionOperand = RuleConditionMetaOperand | RuleConditionPayloadOperand | RuleConditionPrefixOperand | RuleConditionValueOperand;

interface RuleCondition
{
    op: "==" | "!=";
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

interface RulePolicyJump
{
    type: "jump";
    target: string;
}

type RulePolicy = RulePolicyAction | RulePolicyJump;

export interface NetfilterRuleCreationData
{
    conditions: RuleCondition[];
    policy?: RulePolicy;
}

export interface NetfilterRule extends NetfilterRuleCreationData
{
    conditions: RuleCondition[];
    counter: RuleCounter;
    handle: number;
    policy?: RulePolicy;
}

interface ChainCreationProperties
{
    name: string;
    type: "nat";
    hook: "postrouting";
    priority: "srcnat";
    policy: "accept";
}

interface Chain<RuleType>
{
    name: string;
    rules: RuleType[];
    type?: "nat";
    hook?: "postrouting";
    prio?: number;
    policy?: "accept";
}

interface Table<RuleType>
{
    name: string;
    family: string;
    chains: Chain<RuleType>[];
}

@Injectable
export class HostNetfilterService
{
    constructor(private remoteCommandExecutor: RemoteCommandExecutor, private remoteRootFileSystemManager: RemoteRootFileSystemManager, private systemServicesManager: SystemServicesManager)
    {
    }

    //Public methods
    public async AddChain(hostId: number, familyName: string, tableName: string, chainProps: ChainCreationProperties)
    {
        const configArgs = ["{", "type", chainProps.type, "hook", chainProps.hook, "priority", chainProps.priority + ";", "policy", chainProps.policy + ";", "}"];
        await this.remoteCommandExecutor.ExecuteCommand(["sudo", "nft", "add", "chain", familyName, tableName, chainProps.name, configArgs.join(" ")], hostId);
    }

    public async AddNATRule(hostId: number, familyName: string, tableName: string, chainName: string, rule: NetfilterRuleCreationData)
    {
        const conditionArgs = rule.conditions.Values().Map(x => this.ConditionToArgs(x).Values()).Flatten().ToArray();
        const policyArgs = this.PolicyToArgs(rule.policy);
        await this.remoteCommandExecutor.ExecuteCommand(["sudo", "nft", "add", "rule", familyName, tableName, chainName, ...conditionArgs, "counter", ...policyArgs], hostId);

        await this.PersistRuleSet(hostId);
    }

    public async AddTable(hostId: number, family: string, tableName: string)
    {
        await this.remoteCommandExecutor.ExecuteCommand(["sudo", "nft", "add", "table", family, tableName], hostId);
    }

    public async DeleteNATRule(hostId: number, familyName: string, tableName: string, chainName: string, handle: number)
    {
        await this.remoteCommandExecutor.ExecuteCommand(["sudo", "nft", "delete", "rule", familyName, tableName, chainName, "handle", handle.toString()], hostId);

        await this.PersistRuleSet(hostId);
    }

    public async ReadActiveRuleSet(hostId: number)
    {
        const result = await this.ReadNFTables(hostId);
        return result;
    }

    //Private methods
    private ConditionToArgs(condition: RuleCondition): string[]
    {
        const result = this.OperandToArgs(condition.left);
        if(condition.op !== "==")
            result.push(condition.op);
        return result.concat(this.OperandToArgs(condition.right));
    }

    private ConvertMatch(match: any): RuleCondition
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
        const conditions: RuleCondition[] = [];
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

    private async ExportTable(hostId: number, table: Table<NetfilterRule>)
    {
        const result = await this.remoteCommandExecutor.ExecuteBufferedCommand(["sudo", "nft", "list", "table", table.family, table.name], hostId);
        return result.stdOut;
    }

    private OperandToArgs(op: NetfilteRuleConditionOperand): string[]
    {
        switch(op.type)
        {
            case "meta":
                return [op.key];
            case "payload":
                return ["ip", op.field];
            case "prefix":
                return [op.addr + "/" + op.len];
            case "value":
                return [op.value];
        }
    }

    private async PersistRuleSet(hostId: number)
    {
        const ruleSet = await this.ReadActiveRuleSet(hostId);

        const exportedTables = await ruleSet.Values().Filter(x => x.name.startsWith("opc_")).Map(this.ExportTable.bind(this, hostId)).PromiseAll();

        const textContent = "#!/usr/sbin/nft -f\n\nflush ruleset\n\n" + exportedTables.join("\n\n");
        await this.remoteRootFileSystemManager.WriteTextFile(hostId, "/etc/nftables.conf", textContent);

        const enabled = await this.systemServicesManager.IsServiceEnabled(hostId, "nftables");
        if(!enabled)
            await this.systemServicesManager.EnableService(hostId, "nftables");
    }

    private PolicyToArgs(policy: RulePolicy | undefined): string[]
    {
        if(policy === undefined)
            return [];
        else if(policy.type === "jump")
            throw new Error("Method not implemented.");
        return [policy.type];
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
}