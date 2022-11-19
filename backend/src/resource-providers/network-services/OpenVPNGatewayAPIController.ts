/**
 * OpenPrivateCloud
 * Copyright (C) 2019-2022 Amir Czwink (amir130@hotmail.de)
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

import { APIController, Body, BodyProp, Common, Delete, Get, NotFound, Path, Post, Put, Query } from "acts-util-apilib";
import { resourceProviders } from "openprivatecloud-common";
import { c_networkServicesResourceProviderName, c_openVPNGatewayResourceTypeName } from "openprivatecloud-common/dist/constants";
import { HostsController } from "../../data-access/HostsController";
import { HostStoragesController } from "../../data-access/HostStoragesController";
import { InstancesController } from "../../data-access/InstancesController";
import { InstancesManager } from "../../services/InstancesManager";
import { EasyRSAManager } from "./EasyRSAManager";
import { OpenVPNServerConfig } from "./models";
import { OpenVPNGatewayManager } from "./OpenVPNGatewayManager";

interface CommonData
{
    fullInstanceName: string;
    hostId: number;
    instanceId: number;
    storagePath: string;
}

interface OpenVPNGatewayInfo
{
    hostName: string;
}

interface OpenVPNGatewayClient
{
    name: string;
}

@APIController(`resourceProviders/${c_networkServicesResourceProviderName}/${c_openVPNGatewayResourceTypeName}/{instanceName}`)
class OpenVPNGatewayAPIController
{
    constructor(private instancesController: InstancesController, private hostStoragesController: HostStoragesController,
        private hostsController: HostsController, private instancesManager: InstancesManager, private easyRSAManager: EasyRSAManager,
        private openVPNGatwayManager: OpenVPNGatewayManager)
    {
    }

    @Common()
    public async ExtractCommonAPIData(
        @Path instanceName: string
    )
    {
        const fullInstanceName = this.instancesManager.CreateUniqueInstanceName(resourceProviders.networkServices.name, resourceProviders.networkServices.openVPNGatewayResourceType.name, instanceName);
        const instance = await this.instancesController.QueryInstance(fullInstanceName);
        if(instance === undefined)
            return NotFound("instance not found");

        const storage = await this.hostStoragesController.RequestHostStorage(instance!.storageId);

        const result: CommonData = {
            fullInstanceName,
            hostId: storage!.hostId,
            instanceId: instance.id,
            storagePath: storage!.path
        };
        return result;
    }

    @Post("clients")
    public async AddClient(
        @Common common: CommonData,
        @Body client: OpenVPNGatewayClient
    )
    {
        const instanceDir = this.instancesManager.BuildInstanceStoragePath(common.storagePath, common.fullInstanceName);
        await this.easyRSAManager.AddClient(common.hostId, instanceDir, client.name);
    }

    @Get("clientconfig")
    public async QueryClientConfig(
        @Common common: CommonData,
        @Query clientName: string
    )
    {
        const instanceDir = this.instancesManager.BuildInstanceStoragePath(common.storagePath, common.fullInstanceName);
        const instanceConfig = await this.openVPNGatwayManager.ReadInstanceConfig(common.instanceId);
        const paths = this.easyRSAManager.GetCertPaths(instanceDir, clientName);
        const config = await this.openVPNGatwayManager.GenerateClientConfig(common.hostId, instanceDir, instanceConfig.domainName, instanceConfig.dnsServerAddress, common.fullInstanceName, paths);
        console.log(config);

        return config;
    }

    @Get("clients")
    public async QueryClients(
        @Common common: CommonData
    )
    {
        const instanceDir = this.instancesManager.BuildInstanceStoragePath(common.storagePath, common.fullInstanceName);
        const config = await this.openVPNGatwayManager.ReadInstanceConfig(common.instanceId);
        const result = await this.easyRSAManager.ListClients(common.hostId, instanceDir, config.domainName);
        return result.Map(x => {
            const res: OpenVPNGatewayClient = { name: x };
            return res;
        }).ToArray();
    }

    @Get("info")
    public async QueryInfo(
        @Common common: CommonData
    )
    {
        const host = await this.hostsController.RequestHostCredentials(common.hostId);

        const result: OpenVPNGatewayInfo = {
            hostName: host!.hostName,
        };
        return result;
    }

    @Get("config")
    public async QueryServerConfig(
        @Common common: CommonData
    )
    {
        return await this.openVPNGatwayManager.ReadServerConfig(common.hostId, common.fullInstanceName);
    }

    @Delete("clients")
    public async RevokeClient(
        @Common common: CommonData,
        @Body client: OpenVPNGatewayClient
    )
    {
        const instanceDir = this.instancesManager.BuildInstanceStoragePath(common.storagePath, common.fullInstanceName);
        await this.easyRSAManager.RevokeClient(common.hostId, instanceDir, client.name);
        //TODO: restart service in case it is running
    }

    @Put("config")
    public async UpdateServerConfig(
        @Common common: CommonData,
        @Body config: OpenVPNServerConfig
    )
    {
        await this.openVPNGatwayManager.UpdateServerConfig(common.hostId, common.fullInstanceName, config);
    }
}