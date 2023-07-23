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

import { APIController, Common, Get, Path } from "acts-util-apilib";
import { c_letsencryptCertResourceTypeName, c_webServicesResourceProviderName } from "openprivatecloud-common/dist/constants";
import { ResourcesManager } from "../../services/ResourcesManager";
import { LetsEncryptManager } from "./LetsEncryptManager";
import { ResourceAPIControllerBase } from "../ResourceAPIControllerBase";
import { ResourceReference } from "../../common/ResourceReference";

interface LetsEncryptCertInfoDto
{
    hostName: string;
    expiryDate: Date;
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

    @Get("info")
    public async QueryInfo(
        @Common resourceReference: ResourceReference,
    )
    {
        const cert = await this.letsEncryptManager.GetCert(resourceReference);
            
        const result: LetsEncryptCertInfoDto = {
            hostName: resourceReference.hostName,
            expiryDate: cert!.expiryDate
        };
        return result;
    }
}