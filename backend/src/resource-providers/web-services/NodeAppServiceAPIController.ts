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

import { APIController, Body, BodyProp, Common, FormField, Get, Path, Post, Put } from "acts-util-apilib";
import { UploadedFile } from "acts-util-node/dist/http/UploadedFile";
import { c_nodeAppServiceResourceTypeName, c_webServicesResourceProviderName } from "openprivatecloud-common/dist/constants";
import { HostsController } from "../../data-access/HostsController";
import { ResourcesManager } from "../../services/ResourcesManager";
import { NodeAppConfig, NodeAppServiceManager } from "./NodeAppServiceManager";
import { ResourceAPIControllerBase } from "../ResourceAPIControllerBase";
import { ResourceReference } from "../../common/ResourceReference";

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

@APIController(`resourceProviders/{resourceGroupName}/${c_webServicesResourceProviderName}/${c_nodeAppServiceResourceTypeName}/{resourceName}`)
class NodeAppServiceAPIController extends ResourceAPIControllerBase
{
    constructor(resourcesManager: ResourcesManager, private nodeAppServiceManager: NodeAppServiceManager, private hostsController: HostsController)
    {
        super(resourcesManager, c_webServicesResourceProviderName, c_nodeAppServiceResourceTypeName);
    }
    
    @Common()
    public async ExtractCommonAPIData(
        @Path resourceGroupName: string,
        @Path resourceName: string
    )
    {
        return this.FetchResourceReference(resourceGroupName, resourceName);
    }

    @Get("config")
    public async QueryConfig(
        @Common resourceReference: ResourceReference,
    )
    {
        return this.nodeAppServiceManager.QueryConfig(resourceReference);
    }

    @Put("config")
    public async UpdateConfig(
        @Common resourceReference: ResourceReference,
        @Body config: NodeAppConfig
    )
    {
        return this.nodeAppServiceManager.UpdateConfig(resourceReference, config);
    }

    @Get("info")
    public async QueryInfo(
        @Common resourceReference: ResourceReference,
    )
    {            
        const result: NodeAppServiceInfoDto = {
            hostName: resourceReference.hostName,
            storagePath: resourceReference.hostStoragePath,
            isRunning: await this.nodeAppServiceManager.IsAppServiceRunning(resourceReference),
        };
        return result;
    }

    @Get("status")
    public async QueryStatus(
        @Common resourceReference: ResourceReference,
    )
    {
        const result: NodeAppServiceStatus = {
            isRunning: await this.nodeAppServiceManager.IsAppServiceRunning(resourceReference),
            status: await this.nodeAppServiceManager.QueryStatus(resourceReference)
        };
        return result;
    }

    @Post("startStop")
    public async StartOrStopService(
        @Common resourceReference: ResourceReference,
        @BodyProp action: "start" | "stop"
    )
    {
        await this.nodeAppServiceManager.ExecuteAction(resourceReference, action);
    }

    @Post()
    public async UpdateContent(
        @Common resourceReference: ResourceReference,
        @FormField file: UploadedFile
    )
    {
        await this.nodeAppServiceManager.UpdateContent(resourceReference, file.buffer);
    }
}