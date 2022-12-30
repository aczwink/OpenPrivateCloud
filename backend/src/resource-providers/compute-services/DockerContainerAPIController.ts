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
import { c_computeServicesResourceProviderName, c_dockerContainerResourceTypeName } from "openprivatecloud-common/dist/constants";
import { InstanceContext } from "../../common/InstanceContext";
import { HostsController } from "../../data-access/HostsController";
import { InstancesManager } from "../../services/InstancesManager";
import { DockerContainerConfig, DockerManager } from "./DockerManager";


interface DockerContainerInfo
{
    hostName: string;
    state: string;
}

interface DockerContainerLogDto
{
    /**
     * @format multi-line
     */
    stdErr: string;

    /**
     * @format multi-line
     */
    stdOut: string;
}

@APIController(`resourceProviders/${c_computeServicesResourceProviderName}/${c_dockerContainerResourceTypeName}/{instanceName}`)
class DockerContainerAPIController
{
    constructor(private instancesManager: InstancesManager, private hostsController: HostsController, private dockerManager: DockerManager)
    {
    }

    @Common()
    public async ExtractCommonAPIData(
        @Path instanceName: string
    )
    {
        const fullInstanceName = this.instancesManager.CreateUniqueInstanceName(resourceProviders.computeServices.name, resourceProviders.computeServices.dockerContainerResourceType.name, instanceName);
        const instanceContext = await this.instancesManager.CreateInstanceContext(fullInstanceName);
        if(instanceContext === undefined)
            return NotFound("instance not found");

        return instanceContext;
    }

    @Post()
    public async ExecuteVMAction(
        @Common instanceContext: InstanceContext,
        @BodyProp action: "start" | "shutdown"
    )
    {
        await this.dockerManager.ExecuteAction(instanceContext, action);
    }

    @Get("config")
    public async QueryContainerConfig(
        @Common instanceContext: InstanceContext,
    )
    {
        return this.dockerManager.QueryContainerConfig(instanceContext.instanceId);
    }

    @Put("config")
    public async UpdateContainerConfig(
        @Common instanceContext: InstanceContext,
        @Body config: DockerContainerConfig
    )
    {
        return this.dockerManager.UpdateContainerConfig(instanceContext.instanceId, config);
    }

    @Get("info")
    public async QueryContainerInfo(
        @Common instanceContext: InstanceContext,
        @Path instanceName: string
    )
    {
        const host = await this.hostsController.RequestHostCredentials(instanceContext.hostId);
            
        const result: DockerContainerInfo = {
            hostName: host!.hostName,
            state: await this.dockerManager.QueryContainerStatus(instanceContext.hostId, instanceName),
        };
        return result;
    }

    @Get("log")
    public async QueryLog(
        @Common instanceContext: InstanceContext,
        @Path instanceName: string
    )
    {
        const log = await this.dockerManager.QueryLog(instanceContext.hostId, instanceName);

        const result: DockerContainerLogDto = {
            stdErr: log.stdErr,
            stdOut: log.stdOut
        };
        return result;
    }
}