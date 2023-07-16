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

import { APIController, Body, BodyProp, Common, Get, Header, NotFound, Path, Post, Put } from "acts-util-apilib";
import { resourceProviders } from "openprivatecloud-common";
import { c_jdownloaderResourceTypeName, c_webServicesResourceProviderName } from "openprivatecloud-common/dist/constants";
import { InstanceContext } from "../../common/InstanceContext";
import { HostsController } from "../../data-access/HostsController";
import { ResourcesManager } from "../../services/ResourcesManager";
import { SessionsManager } from "../../services/SessionsManager";
import { JdownloaderManager, MyJDownloaderCredentials } from "./JdownloaderManager";

interface JdownloaderInfoDto
{
    hostName: string;
    isActive: boolean;
    storagePath: string;
}

@APIController(`resourceProviders/{resourceGroupName}/${c_webServicesResourceProviderName}/${c_jdownloaderResourceTypeName}/{instanceName}`)
class JdownloaderAPIController
{
    constructor(private jdownloaderManager: JdownloaderManager, private instancesManager: ResourcesManager,
        private hostsController: HostsController, private sessionsManager: SessionsManager)
    {
    }

    @Common()
    public async ExtractCommonAPIData(
        @Path resourceGroupName: string,
        @Path instanceName: string
    )
    {
        const fullInstanceName = this.instancesManager.TODO_DEPRECATED_CreateUniqueInstanceName(resourceProviders.webServices.name, resourceProviders.webServices.jdownloaderResourceType.name, instanceName);
        const instanceContext = await this.instancesManager.TODO_LEGACYCreateInstanceContext(fullInstanceName);
        if(instanceContext === undefined)
            return NotFound("instance not found");

        return instanceContext;
    }

    @Post()
    public async StartStop(
        @Common instanceContext: InstanceContext,
        @BodyProp action: "start" | "stop"
    )
    {
        await this.jdownloaderManager.StartOrStopService(instanceContext.instanceId, action);
    }

    @Get("credentials")
    public async QueryCredentials(
        @Common instanceContext: InstanceContext,
    )
    {
        return await this.jdownloaderManager.QueryCredentials(instanceContext.instanceId);
    }

    @Put("credentials")
    public async UpdateCredentials(
        @Common instanceContext: InstanceContext,
        @Body credentials: MyJDownloaderCredentials
    )
    {
        return await this.jdownloaderManager.SetCredentials(instanceContext.instanceId, credentials);
    }

    @Get("info")
    public async QueryInfo(
        @Common instanceContext: InstanceContext,
    )
    {
        const host = await this.hostsController.RequestHostCredentials(instanceContext.hostId);
            
        const result: JdownloaderInfoDto = {
            hostName: host!.hostName,
            isActive: await this.jdownloaderManager.IsActive(instanceContext.instanceId),
            storagePath: instanceContext.hostStoragePath
        };
        return result;
    }

    @Get("smbconnect")
    public async QuerySMBConnectionInfo(
        @Common instanceContext: InstanceContext,
        @Header Authorization: string
    )
    {
        return await this.jdownloaderManager.GetSMBConnectionInfo(instanceContext, this.sessionsManager.GetUserIdFromAuthHeader(Authorization));
    }
}