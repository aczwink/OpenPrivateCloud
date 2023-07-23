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

import { APIController, Body, BodyProp, Common, Get, Header, Path, Post, Put } from "acts-util-apilib";
import { c_jdownloaderResourceTypeName, c_webServicesResourceProviderName } from "openprivatecloud-common/dist/constants";
import { ResourcesManager } from "../../services/ResourcesManager";
import { SessionsManager } from "../../services/SessionsManager";
import { JdownloaderManager, MyJDownloaderCredentials } from "./JdownloaderManager";
import { ResourceReference } from "../../common/ResourceReference";
import { ResourceAPIControllerBase } from "../ResourceAPIControllerBase";

interface JdownloaderInfoDto
{
    hostName: string;
    isActive: boolean;
    storagePath: string;
}

@APIController(`resourceProviders/{resourceGroupName}/${c_webServicesResourceProviderName}/${c_jdownloaderResourceTypeName}/{resourceName}`)
class JdownloaderAPIController extends ResourceAPIControllerBase
{
    constructor(private jdownloaderManager: JdownloaderManager, resourcesManager: ResourcesManager, private sessionsManager: SessionsManager)
    {
        super(resourcesManager, c_webServicesResourceProviderName, c_jdownloaderResourceTypeName);
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
    public async StartStop(
        @Common resourceReference: ResourceReference,
        @BodyProp action: "start" | "stop"
    )
    {
        await this.jdownloaderManager.StartOrStopService(resourceReference, action);
    }

    @Get("credentials")
    public async QueryCredentials(
        @Common resourceReference: ResourceReference,
    )
    {
        return await this.jdownloaderManager.QueryCredentials(resourceReference);
    }

    @Put("credentials")
    public async UpdateCredentials(
        @Common resourceReference: ResourceReference,
        @Body credentials: MyJDownloaderCredentials
    )
    {
        return await this.jdownloaderManager.SetCredentials(resourceReference, credentials);
    }

    @Get("info")
    public async QueryInfo(
        @Common resourceReference: ResourceReference,
    )
    {            
        const result: JdownloaderInfoDto = {
            hostName: resourceReference.hostName,
            isActive: await this.jdownloaderManager.IsActive(resourceReference),
            storagePath: resourceReference.hostStoragePath
        };
        return result;
    }

    @Get("smbconnect")
    public async QuerySMBConnectionInfo(
        @Common resourceReference: ResourceReference,
        @Header Authorization: string
    )
    {
        return await this.jdownloaderManager.GetSMBConnectionInfo(resourceReference, this.sessionsManager.GetUserIdFromAuthHeader(Authorization));
    }
}