/**
 * OpenPrivateCloud
 * Copyright (C) 2023-2024 Amir Czwink (amir130@hotmail.de)
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

import { c_networkServicesResourceProviderName, c_virtualNetworkResourceTypeName } from "openprivatecloud-common/dist/constants";
import { ResourceAPIControllerBase } from "../../ResourceAPIControllerBase";
import { APIController, Body, BodyProp, Common, Delete, Get, Path, Put } from "acts-util-apilib";
import { ResourcesManager } from "../../../services/ResourcesManager";
import { ResourceReference } from "../../../common/ResourceReference";
import { VNetManager } from "../VNetManager";
import { FirewallRule } from "../../../services/HostFirewallZonesManager";
import { CIDRRange } from "../../../common/CIDRRange";
import { ResourceQueryService } from "../../../services/ResourceQueryService";

interface VNetInfoDTO
{
    /**
     * CIDR-range
     */
    addressSpace: string;
    isDHCPv4Enabled: boolean;

    netAddress: string;
    gatewayIPAddress: string;
    firstUseableIPAddress: string;
    lastUseableIPAddress: string;
    broadcastAddress: string;
    useableIPAddressesCount: number;
}

@APIController(`resourceProviders/{resourceGroupName}/${c_networkServicesResourceProviderName}/${c_virtualNetworkResourceTypeName}/{resourceName}`)
class _api_ extends ResourceAPIControllerBase
{
    constructor(resourcesManager: ResourcesManager, private vnetManager: VNetManager, private resourceQueryService: ResourceQueryService)
    {
        super(resourcesManager, c_networkServicesResourceProviderName, c_virtualNetworkResourceTypeName);
    }

    @Common()
    public async ExtractCommonAPIData(
        @Path resourceGroupName: string,
        @Path resourceName: string
    )
    {
        return this.FetchResourceReference(resourceGroupName, resourceName);
    }

    @Get("info")
    public async QueryInfo(
        @Common resourceReference: ResourceReference,
    )
    {
        const config = await this.vnetManager.QueryConfig(resourceReference);
        const settings = config.settings;

        const range = new CIDRRange(settings.addressSpace);
        const space = this.vnetManager.SubdivideAddressSpace(range);
        const result: VNetInfoDTO = {
            addressSpace: settings.addressSpace,
            isDHCPv4Enabled: settings.enableDHCPv4,
            netAddress: range.netAddress.ToString(),
            gatewayIPAddress: space.gatewayIP.ToString(),
            broadcastAddress: range.brodcastAddress.ToString(),
            firstUseableIPAddress: space.firstDHCP_Address.ToString(),
            lastUseableIPAddress: space.lastDHCP_Address.ToString(),
            useableIPAddressesCount: (space.lastDHCP_Address.intValue - space.firstDHCP_Address.intValue) + 1
        };
        return result;
    }

    @Get("firewall/{direction}")
    public async QueryFirewallRuleSet(
        @Common resourceReference: ResourceReference,
        @Path direction: "Inbound" | "Outbound",
    )
    {
        const config = await this.vnetManager.QueryConfig(resourceReference);
        const rules = (direction === "Inbound") ? config.inboundRules : config.outboundRules;

        //implicit rules
        if(direction === "Inbound")
        {
            rules.push({
                priority: 65535,
                destinationPortRanges: "Any",
                protocol: "Any",
                source: "Any",
                destination: "Any",
                action: "Deny",
                comment: "Deny all inbound traffic"
            });
        }
        else
        {
            rules.push({
                priority: 65535,
                destinationPortRanges: "Any",
                protocol: "Any",
                source: "Any",
                destination: "Any",
                action: "Allow",
                comment: "Allow all outbound traffic"
            });
        }

        return rules;
    }

    @Delete("firewall/{direction}")
    public async DeleteRule(
        @Common resourceReference: ResourceReference,
        @Path direction: "Inbound" | "Outbound",
        @BodyProp priority: number
    )
    {
        await this.vnetManager.DeleteFirewallRule(resourceReference, direction, priority);
    }

    @Put("firewall/{direction}")
    public async SetRule(
        @Common resourceReference: ResourceReference,
        @Path direction: "Inbound" | "Outbound",
        @Body rule: FirewallRule
    )
    {
        await this.vnetManager.SetFirewallRule(resourceReference, direction, rule);
    }

    @Get("resources")
    public async RequestUsingResources(
        @Common resourceReference: ResourceReference,
    )
    {
        const resourceIds = await this.vnetManager.QueryDependentResources(resourceReference);
        return this.resourceQueryService.QueryOverviewData(resourceIds.Values());
    }
}