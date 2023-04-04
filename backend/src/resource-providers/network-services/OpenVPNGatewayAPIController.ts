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

import { APIController, Body, Common, Delete, Get, NotFound, Path, Post, Put, Query } from "acts-util-apilib";
import { resourceProviders } from "openprivatecloud-common";
import { c_networkServicesResourceProviderName, c_openVPNGatewayResourceTypeName } from "openprivatecloud-common/dist/constants";
import { InstanceContext } from "../../common/InstanceContext";
import { HostsController } from "../../data-access/HostsController";
import { InstancesManager } from "../../services/InstancesManager";
import { EasyRSAManager } from "./EasyRSAManager";
import { OpenVPNServerConfig } from "./models";
import { OpenVPNGatewayManager, OpenVPNGatewayPublicEndpointConfig } from "./OpenVPNGatewayManager";

interface OpenVPNGatewayInfo
{
    hostName: string;

    /**
     * @format multi-line
     */
    status: string;
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

@APIController(`resourceProviders/${c_networkServicesResourceProviderName}/${c_openVPNGatewayResourceTypeName}/{instanceName}`)
class OpenVPNGatewayAPIController
{
    constructor(private hostsController: HostsController, private instancesManager: InstancesManager, private easyRSAManager: EasyRSAManager,
        private openVPNGatwayManager: OpenVPNGatewayManager)
    {
    }

    @Common()
    public async ExtractCommonAPIData(
        @Path instanceName: string
    )
    {
        const fullInstanceName = this.instancesManager.CreateUniqueInstanceName(resourceProviders.networkServices.name, resourceProviders.networkServices.openVPNGatewayResourceType.name, instanceName);
        const instanceContext = await this.instancesManager.CreateInstanceContext(fullInstanceName);
        if(instanceContext === undefined)
            return NotFound("instance not found");

        return instanceContext;
    }

    @Post("clients")
    public async AddClient(
        @Common instanceContext: InstanceContext,
        @Body client: OpenVPNGatewayClient
    )
    {
        const instanceDir = this.instancesManager.BuildInstanceStoragePath(instanceContext.hostStoragePath, instanceContext.fullInstanceName);
        await this.easyRSAManager.AddClient(instanceContext.hostId, instanceDir, client.name);
    }

    @Get("clientconfig")
    public async QueryClientConfig(
        @Common instanceContext: InstanceContext,
        @Query clientName: string
    )
    {
        const instanceDir = this.instancesManager.BuildInstanceStoragePath(instanceContext.hostStoragePath, instanceContext.fullInstanceName);
        const paths = this.easyRSAManager.GetCertPaths(instanceDir, clientName);
        const config = await this.openVPNGatwayManager.GenerateClientConfig(instanceContext.hostId, instanceContext.instanceId, instanceDir, instanceContext.fullInstanceName, paths);

        return config;
    }

    @Get("clients")
    public async QueryClients(
        @Common instanceContext: InstanceContext,
    )
    {
        const instanceDir = this.instancesManager.BuildInstanceStoragePath(instanceContext.hostStoragePath, instanceContext.fullInstanceName);
        const config = await this.openVPNGatwayManager.ReadInstanceConfig(instanceContext.instanceId);
        const result = await this.easyRSAManager.ListClients(instanceContext.hostId, instanceDir, config.publicEndpoint.domainName);
        return result.Map(x => {
            const res: OpenVPNGatewayClient = { name: x };
            return res;
        }).ToArray();
    }

    @Get("info")
    public async QueryInfo(
        @Common instanceContext: InstanceContext,
    )
    {
        const host = await this.hostsController.RequestHostCredentials(instanceContext.hostId);
        const status = await this.openVPNGatwayManager.ReadInstanceStatus(instanceContext);

        const result: OpenVPNGatewayInfo = {
            hostName: host!.hostName,
            status
        };
        return result;
    }

    @Get("logs")
    public async QueryLogs(
        @Common instanceContext: InstanceContext,
    )
    {
        return await this.openVPNGatwayManager.ReadInstanceLogs(instanceContext);
    }

    @Get("config")
    public async QueryServerConfig(
        @Common instanceContext: InstanceContext,
    )
    {
        const config: OpenVPNGatewayExternalConfig = {
            publicEndpointConfig: (await this.openVPNGatwayManager.ReadInstanceConfig(instanceContext.instanceId)).publicEndpoint,
            serverConfig: await this.openVPNGatwayManager.ReadServerConfig(instanceContext.hostId, instanceContext.fullInstanceName)
        }
        return config;
    }

    @Delete("clients")
    public async RevokeClient(
        @Common instanceContext: InstanceContext,
        @Body client: OpenVPNGatewayClient
    )
    {
        const instanceDir = this.instancesManager.BuildInstanceStoragePath(instanceContext.hostStoragePath, instanceContext.fullInstanceName);
        await this.easyRSAManager.RevokeClient(instanceContext.hostId, instanceDir, client.name);
        await this.openVPNGatwayManager.RestartServer(instanceContext.hostId, instanceContext.fullInstanceName);
    }

    @Put("config")
    public async UpdateServerConfig(
        @Common instanceContext: InstanceContext,
        @Body config: OpenVPNGatewayExternalConfig
    )
    {
        await this.openVPNGatwayManager.UpdateServerConfig(instanceContext.hostId, instanceContext.fullInstanceName, config.serverConfig);
        await this.openVPNGatwayManager.UpdateInstanceConfig(instanceContext.instanceId, config.publicEndpointConfig);

        await this.openVPNGatwayManager.RestartServer(instanceContext.hostId, instanceContext.fullInstanceName);
    }
}