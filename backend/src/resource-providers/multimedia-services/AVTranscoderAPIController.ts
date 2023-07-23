/**
 * OpenPrivateCloud
 * Copyright (C) 2022-2023 Amir Czwink (amir130@hotmail.de)
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

import { APIController, Body, Common, Get, Path, Post, Put } from "acts-util-apilib";
import { c_avTranscoderResourceTypeName, c_multimediaServicesResourceProviderName } from "openprivatecloud-common/dist/constants";
import { ResourceConfigController } from "../../data-access/ResourceConfigController";
import { ResourcesManager } from "../../services/ResourcesManager";
import { AVTranscoderConfig } from "./AVTranscoderConfig";
import { AVTranscoderService } from "./AVTranscoderService";
import { ResourceAPIControllerBase } from "../ResourceAPIControllerBase";
import { ResourceReference } from "../../common/ResourceReference";

interface AVTranscoderInstanceInfo
{
    hostName: string;
}

@APIController(`resourceProviders/{resourceGroupName}/${c_multimediaServicesResourceProviderName}/${c_avTranscoderResourceTypeName}/{resourceName}`)
class AVTranscoderAPIController extends ResourceAPIControllerBase
{
    constructor(private instanceConfigController: ResourceConfigController, resourcesManager: ResourcesManager, private avTranscoderService: AVTranscoderService)
    {
        super(resourcesManager, c_multimediaServicesResourceProviderName, c_avTranscoderResourceTypeName);
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
        const result: AVTranscoderInstanceInfo = {
            hostName: resourceReference.hostName,
        };
        return result;
    }

    @Get("config")
    public async RequestConfig(
        @Common resourceReference: ResourceReference,
    )
    {
        return await this.ReadConfig(resourceReference.id);
    }

    @Post()
    public async StartTranscodingProcess(
        @Common resourceReference: ResourceReference,
    )
    {
        this.avTranscoderService.Transcode(resourceReference, await this.ReadConfig(resourceReference.id));
    }

    @Put("config")
    public async UpdateConfig(
        @Common resourceReference: ResourceReference,
        @Body config: AVTranscoderConfig
    )
    {
        await this.instanceConfigController.UpdateOrInsertConfig(resourceReference.id, config);
    }

    //Private methods
    private async ReadConfig(instanceId: number)
    {
        return (await this.instanceConfigController.QueryConfig(instanceId)) as AVTranscoderConfig;
    }
}