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

import { APIController, Body, BodyProp, Common, Get, NotFound, Path, Post, Put } from "acts-util-apilib";
import { resourceProviders } from "openprivatecloud-common";
import { c_jdownloaderResourceTypeName, c_webServicesResourceProviderName } from "openprivatecloud-common/dist/constants";
import { HostsController } from "../../data-access/HostsController";
import { HostStoragesController } from "../../data-access/HostStoragesController";
import { InstancesController } from "../../data-access/InstancesController";
import { InstancesManager } from "../../services/InstancesManager";
import { JdownloaderManager, MyJDownloaderCredentials } from "./JdownloaderManager";

interface JdownloaderInfoDto
{
    hostName: string;
    isActive: boolean;
    storagePath: string;
}

@APIController(`resourceProviders/${c_webServicesResourceProviderName}/${c_jdownloaderResourceTypeName}/{instanceName}`)
class JdownloaderAPIController
{
    constructor(private jdownloaderManager: JdownloaderManager, private instancesManager: InstancesManager, private instancesController: InstancesController,
        private hostsController: HostsController, private hostStoragesController: HostStoragesController)
    {
    }

    @Common()
    public async ExtractCommonAPIData(
        @Path instanceName: string
    )
    {
        const fullInstanceName = this.instancesManager.CreateUniqueInstanceName(resourceProviders.webServices.name, resourceProviders.webServices.jdownloaderResourceType.name, instanceName);
        const instance = await this.instancesController.QueryInstance(fullInstanceName);
        if(instance === undefined)
            return NotFound("instance not found");

        return instance.id;
    }

    @Post()
    public async StartStop(
        @Common instanceId: number,
        @BodyProp action: "start" | "stop"
    )
    {
        await this.jdownloaderManager.StartOrStopService(instanceId, action);
    }

    @Get("credentials")
    public async QueryCredentials(
        @Common instanceId: number
    )
    {
        return await this.jdownloaderManager.QueryCredentials(instanceId);
    }

    @Put("credentials")
    public async UpdateCredentials(
        @Common instanceId: number,
        @Body credentials: MyJDownloaderCredentials
    )
    {
        return await this.jdownloaderManager.SetCredentials(instanceId, credentials);
    }

    @Get("info")
    public async QueryInfo(
        @Common instanceId: number,
    )
    {
        const instance = await this.instancesController.QueryInstanceById(instanceId);
        const storage = await this.hostStoragesController.RequestHostStorage(instance!.storageId);
        const host = await this.hostsController.RequestHostCredentials(storage!.hostId);
            
        const result: JdownloaderInfoDto = {
            hostName: host!.hostName,
            isActive: await this.jdownloaderManager.IsActive(instanceId),
            storagePath: storage!.path
        };
        return result;
    }
}