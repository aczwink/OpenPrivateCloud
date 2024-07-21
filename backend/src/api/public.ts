/**
 * OpenPrivateCloud
 * Copyright (C) 2019-2024 Amir Czwink (amir130@hotmail.de)
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

import { APIController, BodyProp, Get, Header, NotFound, Path, Post, Query, Security, Unauthorized } from "acts-util-apilib";
import { ClusterConfigManager } from "../services/ClusterConfigManager";
import { AuthMethod, AuthenticationManager } from "../services/AuthenticationManager";
import { UsersController } from "../data-access/UsersController";
import { SessionsManager } from "../services/SessionsManager";
import { LargeFileDownloadService } from "../services/LargeFileDownloadService";
import { Ok, PartialContent } from "acts-util-apilib/dist/Responses";

@APIController("public")
class _api_
{
    constructor(private authenticationManager: AuthenticationManager, private clusterConfigManager: ClusterConfigManager, private usersController: UsersController, private sessionsManager: SessionsManager,
        private largeFileDownloadService: LargeFileDownloadService)
    {
    }

    @Security()
    @Post("auth")
    public async Create(
        @BodyProp emailAddress: string,
        @BodyProp method: AuthMethod,
        @BodyProp password: string,
    )
    {
        const userId = await this.usersController.QueryUserId(emailAddress);
        if(userId === undefined)
            return NotFound("user does not exist");

        const authResult = await this.authenticationManager.Authenticate(userId, method, password);
        if(!authResult)
            return Unauthorized("invalid login credentials");

        const session = await this.sessionsManager.CreateSession(userId);

        if(method === "client-secret")
            await this.sessionsManager.PasswordBasedLogin(userId, password);
        return session;
    }

    @Security()
    @Get("authMethods")
    public async QueryAuthenticationMethods(
        @Query userName: string
    )
    {
        const userId = await this.usersController.QueryUserId(userName);
        if(userId === undefined)
            return NotFound("user does not exist");

        return this.authenticationManager.RequestAuthenticationMethods(userId);
    }

    @Security()
    @Get("clusterSettings")
    public async QueryClusterConfig()
    {
        const settings = await this.clusterConfigManager.QueryPublicSettings();
        return settings;
    }

    @Security()
    @Post("preAuth")
    public async ExecutePreAuthenticationStep(
        @BodyProp userName: string,
        @BodyProp authMethod: AuthMethod
    )
    {
        const userId = await this.usersController.QueryUserId(userName);
        if(userId === undefined)
            return NotFound("user does not exist");

        return this.authenticationManager.ExecutePreAuthenticationStep(userId, authMethod);
    }

    @Security()
    @Get("largeFile/{id}")
    public async DownloadLargeFile(
        @Path id: string,
        @Header Range?: string
    )
    {
        if(Range === undefined)
        {
            const result = await this.largeFileDownloadService.RequestFull(id);
            if(result === undefined)
                return NotFound("unknown file request");

            return Ok(result.data, {
                "Content-Length": result.totalSize,
                "Content-Type": {
                    mediaType: "video/mp4"
                },
            });
        }
        
        const part = await this.largeFileDownloadService.RequestPart(id, Range);
        if(part === undefined)
            return NotFound("unknown file request");

        return PartialContent(part.data, {
            "Accept-Ranges": "bytes",
            "Content-Range": `bytes ${part.start}-${part.end}/${part.totalSize}`,
            "Content-Length": part.data.byteLength,
            "Content-Type": {
                mediaType: "video/mp4"
            },
        });
    }
}