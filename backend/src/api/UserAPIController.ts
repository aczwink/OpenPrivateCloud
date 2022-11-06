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

import { APIController, BodyProp, Header, Post, Unauthorized } from "acts-util-apilib";
import { UsersController } from "../data-access/UsersController";
import { SessionsManager } from "../services/SessionsManager";
import { UsersManager } from "../services/UsersManager";

@APIController("user")
class UserAPIController
{
    constructor(private sessionsManager: SessionsManager, private usersController: UsersController, private usersManager: UsersManager)
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

        const ok = await this.usersManager.Authenticate(userId, oldPw);
        if(ok)
            await this.usersManager.SetUserPassword(userId, newPw);
        else
            return Unauthorized("wrong password");
    }
}