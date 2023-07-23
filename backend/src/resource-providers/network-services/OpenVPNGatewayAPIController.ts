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

import { APIController, Body, Common, Delete, Get, Path, Post, Put, Query } from "acts-util-apilib";
import { c_networkServicesResourceProviderName, c_openVPNGatewayResourceTypeName } from "openprivatecloud-common/dist/constants";
import { ResourcesManager } from "../../services/ResourcesManager";
import { EasyRSAManager } from "./EasyRSAManager";
import { OpenVPNServerConfig } from "./models";
import { OpenVPNGatewayManager, OpenVPNGatewayPublicEndpointConfig } from "./OpenVPNGatewayManager";
import { ResourceAPIControllerBase } from "../ResourceAPIControllerBase";
import { ResourceReference } from "../../common/ResourceReference";

interface OpenVPNGatewayInfo
{
    hostName: string;
}

interface OpenVPNGatewayClient
{
    name: string;
}

interface OpenVPNGatewayExternalConfig
{
    publicEndpointConfig: OpenVPNGatewayPublicEndpointConfig;
    serverConfig: OpenVPNServerConfig;
}

@APIController(`resourceProviders/{resourceGroupName}/${c_networkServicesResourceProviderName}/${c_openVPNGatewayResourceTypeName}/{resourceName}`)
class OpenVPNGatewayAPIController extends ResourceAPIControllerBase
{
    constructor(resourcesManager: ResourcesManager, private easyRSAManager: EasyRSAManager,
        private openVPNGatwayManager: OpenVPNGatewayManager)
    {
        super(resourcesManager, c_networkServicesResourceProviderName, c_openVPNGatewayResourceTypeName);
    }

    @Common()
    public async ExtractCommonAPIData(
        @Path resourceGroupName: string,
        @Path resourceName: string
    )
    {
        return this.FetchResourceReference(resourceGroupName, resourceName);
    }

    @Get("clientconfig")
    public async QueryClientConfig(
        @Common resourceReference: ResourceReference,
        @Query clientName: string
    )
    {
        const resourceDir = this.resourcesManager.BuildResourceStoragePath(resourceReference);
        const paths = this.easyRSAManager.GetCertPaths(resourceDir, clientName);
        const config = await this.openVPNGatwayManager.GenerateClientConfig(resourceReference.hostId, resourceReference.id, resourceDir, paths);

        return config;
    }

    @Post("clients")
    public async AddClient(
        @Common resourceReference: ResourceReference,
        @Body client: OpenVPNGatewayClient
    )
    {
        const resourceDir = this.resourcesManager.BuildResourceStoragePath(resourceReference);
        await this.easyRSAManager.AddClient(resourceReference.hostId, resourceDir, client.name);
    }

    @Get("clients")
    public async QueryClients(
        @Common resourceReference: ResourceReference,
    )
    {
        const resourceDir = this.resourcesManager.BuildResourceStoragePath(resourceReference);
        const config = await this.openVPNGatwayManager.ReadInstanceConfig(resourceReference.id);
        const result = await this.easyRSAManager.ListClients(resourceReference.hostId, resourceDir, config.publicEndpoint.domainName);
        return result.Map(x => {
            const res: OpenVPNGatewayClient = { name: x };
            return res;
        }).ToArray();
    }

    @Delete("clients")
    public async RevokeClient(
        @Common resourceReference: ResourceReference,
        @Body client: OpenVPNGatewayClient
    )
    {
        const resourceDir = this.resourcesManager.BuildResourceStoragePath(resourceReference);
        await this.easyRSAManager.RevokeClient(resourceReference.hostId, resourceDir, client.name);
        await this.openVPNGatwayManager.RestartServer(resourceReference.hostId, resourceReference.id);
    }

    @Get("connections")
    public async QueryConnections(
        @Common resourceReference: ResourceReference,
    )
    {
        const status = await this.openVPNGatwayManager.ReadInstanceStatus(resourceReference);
        return status;
    }

    @Get("config")
    public async QueryServerConfig(
        @Common resourceReference: ResourceReference,
    )
    {
        const config: OpenVPNGatewayExternalConfig = {
            publicEndpointConfig: (await this.openVPNGatwayManager.ReadInstanceConfig(resourceReference.id)).publicEndpoint,
            serverConfig: await this.openVPNGatwayManager.ReadServerConfig(resourceReference.hostId, resourceReference.id)
        }
        return config;
    }

    @Put("config")
    public async UpdateServerConfig(
        @Common resourceReference: ResourceReference,
        @Body config: OpenVPNGatewayExternalConfig
    )
    {
        await this.openVPNGatwayManager.UpdateServerConfig(resourceReference.hostId, resourceReference.id, config.serverConfig);
        await this.openVPNGatwayManager.UpdateInstanceConfig(resourceReference.id, config.publicEndpointConfig);

        await this.openVPNGatwayManager.RestartServer(resourceReference.hostId, resourceReference.id);
    }

    @Get("info")
    public async QueryInfo(
        @Common resourceReference: ResourceReference,
    )
    {
        const result: OpenVPNGatewayInfo = {
            hostName: resourceReference.hostName,
        };
        return result;
    }

    @Get("logs")
    public async QueryLogs(
        @Common resourceReference: ResourceReference,
    )
    {
        return await this.openVPNGatwayManager.ReadInstanceLogs(resourceReference);
    }
}