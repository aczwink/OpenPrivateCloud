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

import { APIController, Common, FormField, NotFound, Path, Post } from "acts-util-apilib";
import { UploadedFile } from "acts-util-node/dist/http/UploadedFile";
import { resourceProviders } from "openprivatecloud-common";
import { c_staticWebsiteResourceTypeName, c_webServicesResourceProviderName } from "openprivatecloud-common/dist/constants";
import { InstancesController } from "../../data-access/InstancesController";
import { InstancesManager } from "../../services/InstancesManager";
import { StaticWebsitesManager } from "./StaticWebsitesManager";

@APIController(`resourceProviders/${c_webServicesResourceProviderName}/${c_staticWebsiteResourceTypeName}/{instanceName}`)
class StaticWebsiteAPIController
{
    constructor(private instancesManager: InstancesManager, private instancesController: InstancesController, private staticWebsitesManager: StaticWebsitesManager)
    {
    }
    
    @Common()
    public async ExtractCommonAPIData(
        @Path instanceName: string
    )
    {
        const fullInstanceName = this.instancesManager.CreateUniqueInstanceName(resourceProviders.webServices.name, resourceProviders.webServices.staticWebsiteResourceType.name, instanceName);
        const instance = await this.instancesController.QueryInstance(fullInstanceName);
        if(instance === undefined)
            return NotFound("instance not found");

        return instance.id;
    }

    @Post()
    public async UpdateContent(
        @Common instanceId: number,
        @FormField file: UploadedFile
    )
    {
        await this.staticWebsitesManager.UpdateContent(instanceId, file.buffer);
    }
}