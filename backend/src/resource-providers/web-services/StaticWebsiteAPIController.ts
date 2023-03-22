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

import { APIController, Body, Common, FormField, Get, NotFound, Path, Post, Put } from "acts-util-apilib";
import { UploadedFile } from "acts-util-node/dist/http/UploadedFile";
import { resourceProviders } from "openprivatecloud-common";
import { c_staticWebsiteResourceTypeName, c_webServicesResourceProviderName } from "openprivatecloud-common/dist/constants";
import { InstanceContext } from "../../common/InstanceContext";
import { HostsController } from "../../data-access/HostsController";
import { HostStoragesController } from "../../data-access/HostStoragesController";
import { InstancesController } from "../../data-access/InstancesController";
import { InstancesManager } from "../../services/InstancesManager";
import { StaticWebsiteConfig, StaticWebsitesManager } from "./StaticWebsitesManager";

interface StaticWebsiteInfoDto
{
    hostName: string;
    storagePath: string;
    port: number;
}

@APIController(`resourceProviders/${c_webServicesResourceProviderName}/${c_staticWebsiteResourceTypeName}/{instanceName}`)
class StaticWebsiteAPIController
{
    constructor(private instancesManager: InstancesManager, private instancesController: InstancesController, private staticWebsitesManager: StaticWebsitesManager,
        private hostStoragesController: HostStoragesController, private hostsController: HostsController)
    {
    }
    
    @Common()
    public async ExtractCommonAPIData(
        @Path instanceName: string
    )
    {
        const fullInstanceName = this.instancesManager.CreateUniqueInstanceName(resourceProviders.webServices.name, resourceProviders.webServices.staticWebsiteResourceType.name, instanceName);
        const instanceContext = this.instancesManager.CreateInstanceContext(fullInstanceName);
        if(instanceContext === undefined)
            return NotFound("instance not found");

        return instanceContext;
    }

    @Get("config")
    public async QueryConfig(
        @Common instanceContext: InstanceContext,
    )
    {
        return await this.staticWebsitesManager.QueryConfig(instanceContext);
    }

    @Put("config")
    public async UpdateConfig(
        @Common instanceContext: InstanceContext,
        @Body config: StaticWebsiteConfig
    )
    {
        return await this.staticWebsitesManager.UpdateConfig(instanceContext, config);
    }

    @Get("info")
    public async QueryInfo(
        @Common instanceContext: InstanceContext,
    )
    {
        const instance = await this.instancesController.QueryInstanceById(instanceContext.instanceId);
        const storage = await this.hostStoragesController.RequestHostStorage(instance!.storageId);
        const host = await this.hostsController.RequestHostCredentials(storage!.hostId);
            
        const result: StaticWebsiteInfoDto = {
            hostName: host!.hostName,
            storagePath: storage!.path,
            port: await this.staticWebsitesManager.QueryPort(storage!.hostId, instance!.fullName)
        };
        return result;
    }

    @Post()
    public async UpdateContent(
        @Common instanceContext: InstanceContext,
        @FormField file: UploadedFile
    )
    {
        await this.staticWebsitesManager.UpdateContent(instanceContext.instanceId, file.buffer);
    }
}