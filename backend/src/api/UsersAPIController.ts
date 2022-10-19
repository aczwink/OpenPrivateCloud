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
import { APIController, Body, Get, Path, Post } from "acts-util-apilib";
import { UsersController } from "../data-access/UsersController";
import { UsersManager } from "../services/UsersManager";

interface UserCreationData
{
    emailAddress: string;
    password: string;
}

@APIController("users")
class UsersAPIController
{
    constructor(private usersController: UsersController, private usersManager: UsersManager)
    {
    }

    @Post()
    public async Create(
        @Body userCreationData: UserCreationData
    )
    {
        await this.usersManager.CreateUser(userCreationData.emailAddress, userCreationData.password);
    }

    @Get("{userId}")
    public async RequestUser(
        @Path userId: number
    )
    {
        return await this.usersController.QueryUser(userId);
    }

    @Get()
    public async RequestUsers()
    {
        return await this.usersController.QueryUsers();
    }
}