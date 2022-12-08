/**
 * OpenPrivateCloud
 * Copyright (C) 2022 Amir Czwink (amir130@hotmail.de)
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

import { APIController, Body, Common, Get, NotFound, Path, Post, Put } from "acts-util-apilib";
import { resourceProviders } from "openprivatecloud-common";
import { c_avTranscoderResourceTypeName, c_multimediaServicesResourceProviderName } from "openprivatecloud-common/dist/constants";
import { HostsController } from "../../data-access/HostsController";
import { HostStoragesController } from "../../data-access/HostStoragesController";
import { InstanceConfigController } from "../../data-access/InstanceConfigController";
import { InstancesController } from "../../data-access/InstancesController";
import { InstancesManager } from "../../services/InstancesManager";
import { AVTranscoderConfig } from "./AVTranscoderConfig";
import { AVTranscoderService } from "./AVTranscoderService";

interface AVTranscoderInstanceInfo
{
    hostName: string;
}

@APIController(`resourceProviders/${c_multimediaServicesResourceProviderName}/${c_avTranscoderResourceTypeName}/{instanceName}`)
class AVTranscoderAPIController
{
    constructor(private instanceConfigController: InstanceConfigController, private instancesManager: InstancesManager,
        private instancesController: InstancesController, private avTranscoderService: AVTranscoderService,
        private hostStoragesController: HostStoragesController, private hostsController: HostsController)
    {
    }

    @Common()
    public async ExtractCommonAPIData(
        @Path instanceName: string
    )
    {
        const fullInstanceName = this.instancesManager.CreateUniqueInstanceName(resourceProviders.multimediaServices.name, resourceProviders.multimediaServices.avTranscoderResourceType.name, instanceName);
        const instance = await this.instancesController.QueryInstance(fullInstanceName);
        if(instance === undefined)
            return NotFound("instance not found");

        return instance.id;
    }

    @Get("info")
    public async QueryInfo(
        @Common instanceId: number,
    )
    {
        const instance = await this.instancesController.QueryInstanceById(instanceId);
        const storage = await this.hostStoragesController.RequestHostStorage(instance!.storageId);
        const host = await this.hostsController.RequestHostCredentials(storage!.hostId);
            
        const result: AVTranscoderInstanceInfo = {
            hostName: host!.hostName,
        };
        return result;
    }

    @Get("config")
    public async RequestConfig(
        @Common instanceId: number,
    )
    {
        return await this.ReadConfig(instanceId);
    }

    @Post()
    public async StartTranscodingProcess(
        @Common instanceId: number,
    )
    {
        this.avTranscoderService.Transcode(instanceId, await this.ReadConfig(instanceId));
    }

    @Put("config")
    public async UpdateConfig(
        @Common instanceId: number,
        @Body config: AVTranscoderConfig
    )
    {
        await this.instanceConfigController.UpdateOrInsertConfig(instanceId, config);
    }

    //Private methods
    private async ReadConfig(instanceId: number)
    {
        return (await this.instanceConfigController.QueryConfig(instanceId)) as AVTranscoderConfig;
    }
}