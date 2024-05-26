/**
 * OpenPrivateCloud
 * Copyright (C) 2024 Amir Czwink (amir130@hotmail.de)
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
import { ResourcesManager } from "../../../services/ResourcesManager";
import { ResourceReference } from "../../../common/ResourceReference";
import { ResourceAPIControllerBase } from "../../ResourceAPIControllerBase";
import { APIController, Common, Get, Path } from "acts-util-apilib";
import { c_nextcloudResourceTypeName, c_webServicesResourceProviderName } from "openprivatecloud-common/dist/constants";
import { NextcloudManager } from "../NextcloudManager";
import { resourceProviders } from "openprivatecloud-common";

interface NextcloudInfoDTO
{
    ipAddresses: string[];
    port: number;
}

@APIController(`resourceProviders/{resourceGroupName}/${c_webServicesResourceProviderName}/${c_nextcloudResourceTypeName}/{resourceName}`)
class _api_ extends ResourceAPIControllerBase
{
    constructor(private nextcloudManager: NextcloudManager, resourcesManager: ResourcesManager)
    {
        super(resourcesManager, resourceProviders.webServices.name, resourceProviders.webServices.nextcloudResourceType.name);
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
        const info = await this.nextcloudManager.RequestInfo(resourceReference);
        const result: NextcloudInfoDTO = {
            ipAddresses: info.ipAddresses,
            port: info.port
        };
        return result;
    }
}