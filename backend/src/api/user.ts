/**
 * OpenPrivateCloud
 * Copyright (C) 2019-2025 Amir Czwink (amir130@hotmail.de)
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

import { APIController, Auth, Get, Post } from "acts-util-apilib";
import { UsersManager } from "../services/UsersManager";
import { AccessToken } from "../api_security";

@APIController("user")
class UserAPIController
{
    constructor(private usersManager: UsersManager)
    {
    }

    @Get("secret")
    public async QuerySecret(
        @Auth("jwt") accessToken: AccessToken
    )
    {
        const opcUserId = await this.usersManager.MapOAuth2SubjectToOPCUserId(accessToken.sub);
        const sambaPW = await this.usersManager.QuerySambaPassword(opcUserId);
        return sambaPW ?? "";
    }

    @Post("secret")
    public async RotateSecret(
        @Auth("jwt") accessToken: AccessToken
    )
    {
        await this.usersManager.RotateSambaPassword(accessToken.sub);
    }
}