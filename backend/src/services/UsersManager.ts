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
import crypto from "crypto";
import { Injectable } from "acts-util-node";
import { UsersController } from "../data-access/UsersController";
import { HostUsersManager } from "./HostUsersManager";
import { UserWalletManager } from "./UserWalletManager";
import { CreateRSA4096KeyPair } from "../common/crypto/asymmetric";

 
@Injectable
export class UsersManager
{
    constructor(private usersController: UsersController, private hostUsersManager: HostUsersManager, private userWalletManager: UserWalletManager)
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
        const userId = await this.usersController.CreateUser(emailAddress);
        await this.SetUserPassword(userId, password);
        
        await this.RotateSambaPassword(userId);
    }

    public async QuerySambaPassword(userId: number)
    {
        const sambaPW = await this.userWalletManager.ReadStringSecret(userId, "sambaPW");
        return sambaPW;
    }

    public async RotateSambaPassword(userId: number)
    {
        const newPw = this.CreateSambaPassword();

        await this.userWalletManager.SetStringSecret(userId, "sambaPW", newPw);
        await this.hostUsersManager.UpdateSambaPasswordOnAllHosts(userId, newPw);
    }

    public async SetUserPassword(userId: number, newPassword: string)
    {
        if(!this.userWalletManager.IsUnlocked(userId))
            throw new Error("Can't change password when user is not logged in");

        //TODO: this should probably be done in a sql transaction
        throw new Error("TODO: IMPLEMENT THIS SAFELY!");

        const keyPair = CreateRSA4096KeyPair(newPassword);

        const pwSalt = this.CreateSalt();
        const pwHash = this.HashPassword(newPassword, pwSalt);

        await this.usersController.UpdateUserPassword(userId, pwSalt, pwHash, keyPair.privateKey, keyPair.publicKey);

        await this.userWalletManager.PrivateKeyChanged(userId, newPassword);
    }

    //Private methods
    private CreateSalt()
    {
        return crypto.randomBytes(16).toString("hex");
    }

    private CreateSambaPassword()
    {
        const pw = crypto.randomBytes(64).toString("hex");
        return this.HashPassword(pw, this.CreateSalt());
    }

    private HashPassword(password: string, pwSalt: string)
    {
        return crypto.scryptSync(password, pwSalt, 32).toString("hex");
    }
}