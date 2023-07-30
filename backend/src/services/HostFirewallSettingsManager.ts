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
import { HostConfigController } from "../data-access/HostConfigController";
import { FirewallRule, FirewallZoneData, FirewallZoneDataProvider, HostFirewallZonesManager } from "./HostFirewallZonesManager";
import { CIDRRange } from "../common/CIDRRange";

@Injectable
export class HostFirewallSettingsManager implements FirewallZoneDataProvider
{
    constructor(private hostConfigController: HostConfigController, private hostFirewallZonesManager: HostFirewallZonesManager)
    {
    }

    //Properties
    public get matchingZonePrefix(): string
    {
        return "external";
    }
    
    //Public methods
    public async DeleteRule(hostId: number, direction: "Inbound" | "Outbound", priority: number)
    {
        const rules = await this.QueryHostFirewallRules(hostId, direction);

        const idx = rules.findIndex(x => x.priority === priority);
        rules.Remove(idx);

        await this.PersistAndApplyRuleSet(hostId, direction, rules);
    }

    public MatchNetworkInterfaceName(nicName: string): string | null
    {
        return null;
    }

    public async ProvideData(hostId: number): Promise<FirewallZoneData>
    {
        return {
            addressSpace: new CIDRRange("255.255.255.255/32"), //TODO: this is incorrect but this value is currently not used in this case
            inboundRules: await this.QueryHostFirewallRules(hostId, "Inbound"),
            outboundRules: await this.QueryHostFirewallRules(hostId, "Outbound"),
        };
    }

    public async QueryHostFirewallRules(hostId: number, direction: "Inbound" | "Outbound")
    {
        const rawRules = await this.hostConfigController.QueryConfig<FirewallRule[]>(hostId, this.DirectionToConfigKey(direction));
        return rawRules ?? [];
    }

    public async SetRule(hostId: number, direction: "Inbound" | "Outbound", rule: FirewallRule)
    {
        const rules = await this.QueryHostFirewallRules(hostId, direction);

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

        await this.PersistAndApplyRuleSet(hostId, direction, rules);
    }

    //Private methods
    private DirectionToConfigKey(direction: "Inbound" | "Outbound")
    {
        return (direction === "Inbound") ? "firewall_inbound" : "firewall_outbound";
    }

    private async PersistAndApplyRuleSet(hostId: number, direction: "Inbound" | "Outbound", rules: FirewallRule[])
    {
        await this.hostConfigController.UpdateOrInsertConfig(hostId, this.DirectionToConfigKey(direction), rules);
        this.hostFirewallZonesManager.ZoneDataChanged(hostId);
    }
}