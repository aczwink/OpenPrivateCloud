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

import { APIController, Common, Get, NotFound, Path } from "acts-util-apilib";
import { resourceProviders } from "openprivatecloud-common";
import { c_networkServicesResourceProviderName, c_openVPNGatewayResourceTypeName } from "openprivatecloud-common/dist/constants";
import { HostsController } from "../../data-access/HostsController";
import { HostStoragesController } from "../../data-access/HostStoragesController";
import { InstancesController } from "../../data-access/InstancesController";
import { InstancesManager } from "../../services/InstancesManager";

interface OpenVPNGatewayInfo
{
    hostName: string;
}

@APIController(`resourceProviders/${c_networkServicesResourceProviderName}/${c_openVPNGatewayResourceTypeName}/{instanceName}`)
class OpenVPNGatewayAPIController
{
    constructor(private instancesController: InstancesController, private hostStoragesController: HostStoragesController,
        private hostsController: HostsController, private instancesManager: InstancesManager)
    {
    }

    @Get("info")
    public async QueryInfo(
        @Path instanceName: string
    )
    {
        const fullInstanceName = this.instancesManager.CreateUniqueInstanceName(resourceProviders.networkServices.name, resourceProviders.networkServices.openVPNGatewayResourceType.name, instanceName);
        const instance = await this.instancesController.QueryInstance(fullInstanceName);
        if(instance === undefined)
            return NotFound("instance not found");

        const storage = await this.hostStoragesController.RequestHostStorage(instance!.storageId);
        const host = await this.hostsController.RequestHostCredentials(storage!.hostId);

        const result: OpenVPNGatewayInfo = {
            hostName: host!.hostName,
        };
        return result;
    }
}