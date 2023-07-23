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

import { APIController, Body, BodyProp, Common, Get, Path, Post, Put } from "acts-util-apilib";
import { c_computeServicesResourceProviderName, c_dockerContainerResourceTypeName } from "openprivatecloud-common/dist/constants";
import { ResourcesManager } from "../../services/ResourcesManager";
import { DockerContainerManager } from "./DockerContainerManager";
import { DockerContainerConfig } from "./DockerManager";
import { ResourceAPIControllerBase } from "../ResourceAPIControllerBase";
import { ResourceReference } from "../../common/ResourceReference";


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

@APIController(`resourceProviders/{resourceGroupName}/${c_computeServicesResourceProviderName}/${c_dockerContainerResourceTypeName}/{resourceName}`)
class _api_ extends ResourceAPIControllerBase
{
    constructor(instancesManager: ResourcesManager, private dockerContainerManager: DockerContainerManager)
    {
        super(instancesManager, c_computeServicesResourceProviderName, c_dockerContainerResourceTypeName);
    }

    @Common()
    public async ExtractCommonAPIData(
        @Path resourceGroupName: string,
        @Path resourceName: string
    )
    {
        return this.FetchResourceReference(resourceGroupName, resourceName);
    }

    @Post()
    public async ExecuteContainerAction(
        @Common resourceReference: ResourceReference,
        @BodyProp action: "start" | "shutdown"
    )
    {
        await this.dockerContainerManager.ExecuteAction(resourceReference, action);
    }

    @Get("config")
    public async QueryContainerConfig(
        @Common resourceReference: ResourceReference
    )
    {
        return this.dockerContainerManager.QueryContainerConfig(resourceReference.id);
    }

    @Put("config")
    public async UpdateContainerConfig(
        @Common resourceReference: ResourceReference,
        @Body config: DockerContainerConfig
    )
    {
        return this.dockerContainerManager.UpdateContainerConfig(resourceReference.id, config);
    }

    @Get("info")
    public async QueryContainerInfo(
        @Common resourceReference: ResourceReference
    )
    {            
        const result: DockerContainerInfo = {
            hostName: resourceReference.hostName,
            state: await this.dockerContainerManager.QueryContainerStatus(resourceReference),
        };
        return result;
    }

    @Get("log")
    public async QueryLog(
        @Common resourceReference: ResourceReference
    )
    {
        const log = await this.dockerContainerManager.QueryLog(resourceReference);

        const result: DockerContainerLogDto = {
            stdErr: log.stdErr,
            stdOut: log.stdOut
        };
        return result;
    }

    @Post("update")
    public async UpdateContainerImage(
        @Common resourceReference: ResourceReference
    )
    {
        await this.dockerContainerManager.UpdateContainerImage(resourceReference);
    }
}