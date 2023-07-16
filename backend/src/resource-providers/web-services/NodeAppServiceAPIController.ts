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

import { APIController, Body, BodyProp, Common, FormField, Get, NotFound, Path, Post, Put } from "acts-util-apilib";
import { UploadedFile } from "acts-util-node/dist/http/UploadedFile";
import { resourceProviders } from "openprivatecloud-common";
import { c_nodeAppServiceResourceTypeName, c_webServicesResourceProviderName } from "openprivatecloud-common/dist/constants";
import { InstanceContext } from "../../common/InstanceContext";
import { HostsController } from "../../data-access/HostsController";
import { ResourcesManager } from "../../services/ResourcesManager";
import { NodeAppConfig, NodeAppServiceManager } from "./NodeAppServiceManager";

interface NodeAppServiceInfoDto
{
    hostName: string;
    storagePath: string;
    isRunning: boolean;
}

interface NodeAppServiceStatus
{
    isRunning: boolean;
    /**
     * @format multi-line
     */
    status: string;
}

@APIController(`resourceProviders/{resourceGroupName}/${c_webServicesResourceProviderName}/${c_nodeAppServiceResourceTypeName}/{instanceName}`)
class NodeAppServiceAPIController
{
    constructor(private instancesManager: ResourcesManager, private nodeAppServiceManager: NodeAppServiceManager, private hostsController: HostsController)
    {
    }
    
    @Common()
    public async ExtractCommonAPIData(
        @Path resourceGroupName: string,
        @Path instanceName: string
    )
    {
        const fullInstanceName = this.instancesManager.TODO_DEPRECATED_CreateUniqueInstanceName(resourceProviders.webServices.name, resourceProviders.webServices.nodeAppServiceResourceType.name, instanceName);
        const instanceContext = await this.instancesManager.TODO_LEGACYCreateInstanceContext(fullInstanceName);
        if(instanceContext === undefined)
            return NotFound("instance not found");

        return instanceContext;
    }

    @Get("config")
    public async QueryConfig(
        @Common instanceContext: InstanceContext,
    )
    {
        return this.nodeAppServiceManager.QueryConfig(instanceContext);
    }

    @Put("config")
    public async UpdateConfig(
        @Common instanceContext: InstanceContext,
        @Body config: NodeAppConfig
    )
    {
        return this.nodeAppServiceManager.UpdateConfig(instanceContext, config);
    }

    @Get("info")
    public async QueryInfo(
        @Common instanceContext: InstanceContext,
    )
    {
        const host = await this.hostsController.RequestHostCredentials(instanceContext.hostId);
            
        const result: NodeAppServiceInfoDto = {
            hostName: host!.hostName,
            storagePath: instanceContext.hostStoragePath,
            isRunning: await this.nodeAppServiceManager.IsAppServiceRunning(instanceContext.hostId, instanceContext.fullInstanceName),
        };
        return result;
    }

    @Get("status")
    public async QueryStatus(
        @Common instanceContext: InstanceContext,
    )
    {
        const result: NodeAppServiceStatus = {
            isRunning: await this.nodeAppServiceManager.IsAppServiceRunning(instanceContext.hostId, instanceContext.fullInstanceName),
            status: await this.nodeAppServiceManager.QueryStatus(instanceContext.hostId, instanceContext.fullInstanceName)
        };
        return result;
    }

    @Post("startStop")
    public async StartOrStopService(
        @Common instanceContext: InstanceContext,
        @BodyProp action: "start" | "stop"
    )
    {
        await this.nodeAppServiceManager.ExecuteAction(instanceContext.hostId, instanceContext.fullInstanceName, action);
    }

    @Post()
    public async UpdateContent(
        @Common instanceContext: InstanceContext,
        @FormField file: UploadedFile
    )
    {
        await this.nodeAppServiceManager.UpdateContent(instanceContext.instanceId, file.buffer);
    }
}