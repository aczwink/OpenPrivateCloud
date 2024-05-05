/**
 * OpenPrivateCloud
 * Copyright (C) 2023-2024 Amir Czwink (amir130@hotmail.de)
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

import { APIController, Body, Common, Get, Path, Put } from "acts-util-apilib";
import { c_letsencryptCertResourceTypeName, c_webServicesResourceProviderName } from "openprivatecloud-common/dist/constants";
import { ResourcesManager } from "../../../services/ResourcesManager";
import { LetsEncryptManager } from "../LetsEncryptManager";
import { ResourceAPIControllerBase } from "../../ResourceAPIControllerBase";
import { ResourceReference } from "../../../common/ResourceReference";

interface LetsEncryptCertInfoDTO
{
    expiryDate: Date;
    remainingValidDays: number;
}

interface LetsEncryptConfigDTO
{
    /**
     * LetsEncrypt will verify certificates by issuing requests on port 80 to the domain. Specify a different port in case you use port mapping.
     */
    sourcePort: number;
}

interface LetsEncryptLogsDTO
{
    /**
     * @format multi-line
     */
    log: string;
}

@APIController(`resourceProviders/{resourceGroupName}/${c_webServicesResourceProviderName}/${c_letsencryptCertResourceTypeName}/{resourceName}`)
class LetsEncryptAPIController extends ResourceAPIControllerBase
{
    constructor(resourcesManager: ResourcesManager, private letsEncryptManager: LetsEncryptManager)
    {
        super(resourcesManager, c_webServicesResourceProviderName, c_letsencryptCertResourceTypeName);
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
        const config = await this.letsEncryptManager.ReadConfig(resourceReference.id);
            
        const result: LetsEncryptConfigDTO = {
            sourcePort: config.sourcePort,
        };
        return result;
    }

    @Put("config")
    public async UpdateConfig(
        @Common resourceReference: ResourceReference,
        @Body newValues: LetsEncryptConfigDTO
    )
    {
        const config = await this.letsEncryptManager.ReadConfig(resourceReference.id);
        config.sourcePort = newValues.sourcePort;

        await this.letsEncryptManager.WriteConfig(resourceReference.id, config);
    }

    @Get("info")
    public async QueryInfo(
        @Common resourceReference: ResourceReference,
    )
    {
        const expiryDate = await this.letsEncryptManager.ReadExpiryDate(resourceReference);
            
        const result: LetsEncryptCertInfoDTO = {
            expiryDate: expiryDate ?? new Date(NaN),
            remainingValidDays: Math.round(await this.letsEncryptManager.RequestNumberOfRemainingValidDays(resourceReference))
        };
        return result;
    }

    @Get("logs")
    public async QueryLogs(
        @Common resourceReference: ResourceReference,
    )
    {
        const logs = await this.letsEncryptManager.RequestLogs(resourceReference);
        const dto: LetsEncryptLogsDTO = {
            log: logs
        };
        return dto;
    }
}