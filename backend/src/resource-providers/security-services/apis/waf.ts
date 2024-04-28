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

import { ResourceAPIControllerBase } from "../../ResourceAPIControllerBase";
import { APIController, Body, Common, Get, Path, Put } from "acts-util-apilib";
import { ResourcesManager } from "../../../services/ResourcesManager";
import { ResourceReference } from "../../../common/ResourceReference";
import { c_securityServicesResourceProviderName, c_wafResourceTypeName } from "openprivatecloud-common/dist/constants";
import { resourceProviders } from "openprivatecloud-common";
import { WAFConfig, WAFManager } from "../WAFManager";

@APIController(`resourceProviders/{resourceGroupName}/${c_securityServicesResourceProviderName}/${c_wafResourceTypeName}/{resourceName}`)
class _api_ extends ResourceAPIControllerBase
{
    constructor(resourcesManager: ResourcesManager, private wafManager: WAFManager)
    {
        super(resourcesManager, resourceProviders.securityServices.name, resourceProviders.securityServices.wafResourceTypeName.name);
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
    public QueryInfo(
        @Common resourceReference: ResourceReference,
    )
    {
        return this.wafManager.QueryInfo(resourceReference);
    }

    @Get("log")
    public async QueryLog(
        @Common resourceReference: ResourceReference
    )
    {
        const log = await this.wafManager.QueryLog(resourceReference);
        return log;
    }

    @Get("matches")
    public async QueryFirewallMatches(
        @Common resourceReference: ResourceReference
    )
    {
        const log = await this.wafManager.RequestFirewallMatches(resourceReference);
        return log;
    }

    @Get("settings")
    public QuerySettings(
        @Common resourceReference: ResourceReference,
    )
    {
        return this.wafManager.QuerySettings(resourceReference);
    }

    @Put("settings")
    public UpdateServerSettings(
        @Common resourceReference: ResourceReference,
        @Body settings: WAFConfig
    )
    {
        return this.wafManager.UpdateSettings(resourceReference, settings);
    }
}