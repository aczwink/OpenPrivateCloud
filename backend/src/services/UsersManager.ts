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
import crypto from "crypto";
import { Injectable } from "acts-util-node";
import { UsersController } from "../data-access/UsersController";
import { HashPassword } from "../common/crypto/passwords";
import { ClusterEventsManager } from "./ClusterEventsManager";

 
@Injectable
export class UsersManager
{
    constructor(private usersController: UsersController, private clusterEventsManager: ClusterEventsManager)
    {
    }
    
    //Public methods
    public async CreateUser(emailAddress: string)
    {
        const userId = await this.usersController.CreateUser(emailAddress, this.CreateSambaPassword());
        return userId;
    }

    public async QuerySambaPassword(userId: number)
    {
        const sambaPW = await this.usersController.ReadServiceSecret(userId);
        return sambaPW;
    }

    public async RotateSambaPassword(userId: number)
    {
        const newPw = this.CreateSambaPassword();

        await this.usersController.UpdateServiceSecret(userId, newPw);

        this.clusterEventsManager.PublishEvent({
            type: "userSambaPasswordChanged",
            userId,
        });
    }

    //Private methods
    private CreateSalt()
    {
        return crypto.randomBytes(16).toString("hex");
    }

    private CreateSambaPassword()
    {
        const pw = crypto.randomBytes(64).toString("hex");
        return HashPassword(pw, this.CreateSalt());
    }
}