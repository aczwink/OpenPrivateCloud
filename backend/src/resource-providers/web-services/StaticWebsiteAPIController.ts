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

import { APIController, Body, Common, FormField, Get, Path, Post, Put } from "acts-util-apilib";
import { UploadedFile } from "acts-util-node/dist/http/UploadedFile";
import { c_staticWebsiteResourceTypeName, c_webServicesResourceProviderName } from "openprivatecloud-common/dist/constants";
import { ResourcesManager } from "../../services/ResourcesManager";
import { StaticWebsiteConfig, StaticWebsitesManager } from "./StaticWebsitesManager";
import { ResourceAPIControllerBase } from "../ResourceAPIControllerBase";
import { ResourceReference } from "../../common/ResourceReference";

interface StaticWebsiteInfoDto
{
    hostName: string;
    storagePath: string;
    port: number;
}

@APIController(`resourceProviders/{resourceGroupName}/${c_webServicesResourceProviderName}/${c_staticWebsiteResourceTypeName}/{resourceName}`)
class StaticWebsiteAPIController extends ResourceAPIControllerBase
{
    constructor(resourcesManager: ResourcesManager, private staticWebsitesManager: StaticWebsitesManager)
    {
        super(resourcesManager, c_webServicesResourceProviderName, c_staticWebsiteResourceTypeName);
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
        return await this.staticWebsitesManager.QueryConfig(resourceReference);
    }

    @Put("config")
    public async UpdateConfig(
        @Common resourceReference: ResourceReference,
        @Body config: StaticWebsiteConfig
    )
    {
        return await this.staticWebsitesManager.UpdateConfig(resourceReference, config);
    }

    @Get("info")
    public async QueryInfo(
        @Common resourceReference: ResourceReference,
    )
    {            
        const result: StaticWebsiteInfoDto = {
            hostName: resourceReference.hostName,
            storagePath: resourceReference.hostStoragePath,
            port: await this.staticWebsitesManager.QueryPort(resourceReference)
        };
        return result;
    }

    @Post()
    public async UpdateContent(
        @Common resourceReference: ResourceReference,
        @FormField file: UploadedFile
    )
    {
        await this.staticWebsitesManager.UpdateContent(resourceReference, file.buffer);
    }
}