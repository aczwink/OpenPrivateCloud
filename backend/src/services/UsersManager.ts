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
import crypto from "crypto";
import { Injectable } from "acts-util-node";
import { UsersController } from "../data-access/UsersController";

 
@Injectable
export class UsersManager
{
    constructor(private usersController: UsersController)
    {
    }
    
    //Public methods
    public async Authenticate(userId: number, password: string)
    {
        const user = await this.usersController.QueryPrivateData(userId);
        if(user === undefined)
            return null;
            
        const expectedHash = this.HashPassword(password, user.pwSalt);
        return expectedHash === user.pwHash;
    }

    public async CreateUser(emailAddress: string, password: string)
    {
        const pwSalt = this.CreateSalt();
        const pwHash = this.HashPassword(password, pwSalt);
        await this.usersController.CreateUser(emailAddress, pwHash, pwSalt);
    }

    public async SetUserPassword(userId: number, password: string)
    {
        const pwSalt = this.CreateSalt();
        const pwHash = this.HashPassword(password, pwSalt);
        await this.usersController.UpdateUserPassword(userId, pwSalt, pwHash);
    }

    //Private methods
    private CreateSalt()
    {
        return crypto.randomBytes(16).toString("hex");
    }

    private HashPassword(password: string, pwSalt: string)
    {
        return crypto.scryptSync(password, pwSalt, 32).toString("hex");
    }
}