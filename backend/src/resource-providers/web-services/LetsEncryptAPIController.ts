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

import { APIController, Common, Get, NotFound, Path } from "acts-util-apilib";
import { resourceProviders } from "openprivatecloud-common";
import { c_letsencryptCertResourceTypeName, c_webServicesResourceProviderName } from "openprivatecloud-common/dist/constants";
import { InstanceContext } from "../../common/InstanceContext";
import { HostsController } from "../../data-access/HostsController";
import { ResourcesManager } from "../../services/ResourcesManager";
import { LetsEncryptManager } from "./LetsEncryptManager";

interface LetsEncryptCertInfoDto
{
    hostName: string;
    expiryDate: Date;
}

@APIController(`resourceProviders/{resourceGroupName}/${c_webServicesResourceProviderName}/${c_letsencryptCertResourceTypeName}/{instanceName}`)
class LetsEncryptAPIController
{
    constructor(private instancesManager: ResourcesManager, private hostsController: HostsController, private letsEncryptManager: LetsEncryptManager)
    {
    }

    @Common()
    public async ExtractCommonAPIData(
        @Path resourceGroupName: string,
        @Path instanceName: string
    )
    {
        const fullInstanceName = this.instancesManager.TODO_DEPRECATED_CreateUniqueInstanceName(resourceProviders.webServices.name, resourceProviders.webServices.letsencryptCertResourceType.name, instanceName);
        const instanceContext = await this.instancesManager.TODO_LEGACYCreateInstanceContext(fullInstanceName);
        if(instanceContext === undefined)
            return NotFound("instance not found");

        return instanceContext;
    }

    @Get("info")
    public async QueryInfo(
        @Common instanceContext: InstanceContext,
    )
    {
        const host = await this.hostsController.RequestHostCredentials(instanceContext.hostId);
        const cert = await this.letsEncryptManager.GetCert(instanceContext.hostId, instanceContext.fullInstanceName);
            
        const result: LetsEncryptCertInfoDto = {
            hostName: host!.hostName,
            expiryDate: cert.expiryDate
        };
        return result;
    }
}