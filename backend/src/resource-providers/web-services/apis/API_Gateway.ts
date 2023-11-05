/**
 * OpenPrivateCloud
 * Copyright (C) 2019-2023 Amir Czwink (amir130@hotmail.de)
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
import { APIController, Body, BodyProp, Common, Delete, Get, Path, Post, Put } from "acts-util-apilib";
import { ResourcesManager } from "../../../services/ResourcesManager";
import { ResourceReference } from "../../../common/ResourceReference";
import { c_apiGatewayResourceTypeName, c_webServicesResourceProviderName } from "openprivatecloud-common/dist/constants";
import { API_EntryConfig, API_GatewayManager, API_GatewaySettings } from "../API_GatewayManager";
import { DockerContainerLogDto } from "../../compute-services/api/docker-container-app-service";

@APIController(`resourceProviders/{resourceGroupName}/${c_webServicesResourceProviderName}/${c_apiGatewayResourceTypeName}/{resourceName}`)
class _api_ extends ResourceAPIControllerBase
{
    constructor(resourcesManager: ResourcesManager, private apiGatewayManager: API_GatewayManager)
    {
        super(resourcesManager, c_webServicesResourceProviderName, c_apiGatewayResourceTypeName);
    }

    @Common()
    public async ExtractCommonAPIData(
        @Path resourceGroupName: string,
        @Path resourceName: string
    )
    {
        return this.FetchResourceReference(resourceGroupName, resourceName);
    }

    @Post("apis")
    public async AddAPI(
        @Common resourceReference: ResourceReference,
        @Body api: API_EntryConfig
    )
    {
        await this.apiGatewayManager.AddAPI(resourceReference, api);
    }

    @Delete("apis")
    public async DeleteAPI(
        @Common resourceReference: ResourceReference,
        @Body api: API_EntryConfig
    )
    {
        await this.apiGatewayManager.DeleteAPI(resourceReference, api);
    }

    @Get("apis")
    public QueryAPIs(
        @Common resourceReference: ResourceReference,
    )
    {
        return this.apiGatewayManager.QueryAPIs(resourceReference);
    }

    @Put("apis")
    public async UpdateAPI(
        @Common resourceReference: ResourceReference,
        @BodyProp oldFrontendDomainName: string,
        @BodyProp newProps: API_EntryConfig
    )
    {
        await this.apiGatewayManager.UpdateAPI(resourceReference, oldFrontendDomainName, newProps);
    }

    @Get("info")
    public QueryInfo(
        @Common resourceReference: ResourceReference,
    )
    {
        return this.apiGatewayManager.QueryInfo(resourceReference);
    }

    @Get("log")
    public async QueryLog(
        @Common resourceReference: ResourceReference
    )
    {
        const log = await this.apiGatewayManager.QueryLog(resourceReference);

        const result: DockerContainerLogDto = {
            stdErr: log.stdErr,
            stdOut: log.stdOut
        };
        return result;
    }

    @Get("settings")
    public QuerySettings(
        @Common resourceReference: ResourceReference,
    )
    {
        return this.apiGatewayManager.QuerySettings(resourceReference);
    }

    @Put("settings")
    public UpdateServerSettings(
        @Common resourceReference: ResourceReference,
        @Body settings: API_GatewaySettings
    )
    {
        return this.apiGatewayManager.UpdateSettings(resourceReference, settings);
    }
}