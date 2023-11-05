/**
 * OpenPrivateCloud
 * Copyright (C) 2023 Amir Czwink (amir130@hotmail.de)
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

import { ResourceAPIControllerBase } from "../../ResourceAPIControllerBase";
import { APIController, Body, Common, Get, Path, Put } from "acts-util-apilib";
import { ResourcesManager } from "../../../services/ResourcesManager";
import { ResourceReference } from "../../../common/ResourceReference";
import { c_activeDirectoryDomainControllerResourceTypeName, c_integrationServicesResourceProviderName } from "openprivatecloud-common/dist/constants";
import { ADDC_Configuration, ADDC_Settings, ActiveDirectoryDomainControllerManager } from "../ActiveDirectoryDomainControllerManager";
import { DockerContainerLogDto } from "../../compute-services/api/docker-container-app-service";

interface ADDC_InfoDTO
{
    configuration: ADDC_Settings;
    ipAddresses: string[];
}

interface ADDC_UserDTO
{
    /**
     * @title User
     * @format user
     */
    userId: string;

    mappedName: string;
    domainName: string;
    netBiosName: string;
    state: string;
}

@APIController(`resourceProviders/{resourceGroupName}/${c_integrationServicesResourceProviderName}/${c_activeDirectoryDomainControllerResourceTypeName}/{resourceName}`)
class _api_ extends ResourceAPIControllerBase
{
    constructor(resourcesManager: ResourcesManager, private activeDirectoryDomainControllerManager: ActiveDirectoryDomainControllerManager)
    {
        super(resourcesManager, c_integrationServicesResourceProviderName, c_activeDirectoryDomainControllerResourceTypeName);
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
        const data = await this.activeDirectoryDomainControllerManager.QueryConfig(resourceReference);
        return data;
    }

    @Put("config")
    public async UpdateConfig(
        @Common resourceReference: ResourceReference,
        @Body config: ADDC_Configuration
    )
    {
        await this.activeDirectoryDomainControllerManager.UpdateDCConfig(resourceReference, config);
    }

    @Get("info")
    public async QueryInfo(
        @Common resourceReference: ResourceReference,
    )
    {
        const data = await this.activeDirectoryDomainControllerManager.QueryInfo(resourceReference);
        const result: ADDC_InfoDTO = {
            configuration: data.config,
            ipAddresses: data.containerInfo.ipAddresses
        };
        return result;
    }

    @Get("log")
    public async QueryLog(
        @Common resourceReference: ResourceReference
    )
    {
        const log = await this.activeDirectoryDomainControllerManager.QueryLog(resourceReference);

        const result: DockerContainerLogDto = {
            stdErr: log.stdErr,
            stdOut: log.stdOut
        };
        return result;
    }

    @Get("users")
    public async QueryUsers(
        @Common resourceReference: ResourceReference,
    )
    {
        const info = await this.activeDirectoryDomainControllerManager.QueryInfo(resourceReference);

        const data = await this.activeDirectoryDomainControllerManager.QueryUsers(resourceReference);
        return data.Entries().Map<ADDC_UserDTO>(x => ({
            userId: x.key.toString(), mappedName: x.value!.mappedName,
            domainName: x.value!.mappedName + "@" + info.config.domain,
            netBiosName: info.config.domain.split(".")[0].toUpperCase() + "\\" + x.value!.mappedName,
            state: x.value!.state
        })).ToArray();
    }
}