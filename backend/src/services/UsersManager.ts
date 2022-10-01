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
    public async CreateUser(emailAddress: string, password: string)
    {
        const pwSalt = crypto.randomBytes(16).toString("hex");
        const pwHash = this.HashPassword(password, pwSalt);
        await this.usersController.CreateUser(emailAddress, pwHash, pwSalt);
    }

    public HashPassword(password: string, pwSalt: string)
    {
        return crypto.scryptSync(password, pwSalt, 32).toString("hex");
    }
}