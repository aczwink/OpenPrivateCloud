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

import { APIController, BodyProp, Get, Header, Post, Unauthorized } from "acts-util-apilib";
import { UsersController } from "../data-access/UsersController";
import { SessionsManager } from "../services/SessionsManager";
import { UsersManager } from "../services/UsersManager";
import { AuthenticationManager } from "../services/AuthenticationManager";

@APIController("user")
class UserAPIController
{
    constructor(private sessionsManager: SessionsManager, private usersController: UsersController, private usersManager: UsersManager, private authenticationManager: AuthenticationManager)
    {
    }
    
    @Post()
    public async ChangePassword(
        @BodyProp oldPw: string,
        @BodyProp newPw: string,
        @Header Authorization: string
    )
    {
        const userId = this.sessionsManager.GetUserIdFromAuthHeader(Authorization);

        const ok = await this.authenticationManager.Authenticate(userId, "client-secret", oldPw);
        if(ok)
            await this.usersManager.SetUserPassword(userId, newPw);
        else
        {
            const hasPw = await this.authenticationManager.DoesUserHavePassword(userId);
            if(!hasPw && (oldPw === ""))
                await this.usersManager.SetUserPassword(userId, newPw);
            else
                return Unauthorized("wrong password");
        }
    }

    @Get()
    public async QueryUser(
        @Header Authorization: string
    )
    {
        const userId = this.sessionsManager.GetUserIdFromAuthHeader(Authorization);
        const user = await this.usersController.QueryUser(userId);
        return user!;
    }

    @Get("secret")
    public async QuerySecret(
        @Header Authorization: string
    )
    {
        const userId = this.sessionsManager.GetUserIdFromAuthHeader(Authorization);
        const sambaPW = await this.usersManager.QuerySambaPassword(userId);
        return sambaPW ?? "";
    }

    @Post("secret")
    public async RotateSecret(
        @Header Authorization: string
    )
    {
        const userId = this.sessionsManager.GetUserIdFromAuthHeader(Authorization);
        await this.usersManager.RotateSambaPassword(userId);
    }
}