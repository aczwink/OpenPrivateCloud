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
import crypto from "crypto";
import { Injectable } from "acts-util-node";
import { UsersController } from "../data-access/UsersController";
import { UserWalletManager } from "./UserWalletManager";
import { CreateRSA4096KeyPair } from "../common/crypto/asymmetric";
import { HashPassword } from "../common/crypto/passwords";
import { ClusterEventsManager } from "./ClusterEventsManager";

 
@Injectable
export class UsersManager
{
    constructor(private usersController: UsersController, private userWalletManager: UserWalletManager, private clusterEventsManager: ClusterEventsManager)
    {
    }
    
    //Public methods
    public async CreateUser(emailAddress: string)
    {
        const userId = await this.usersController.CreateUser(emailAddress);
        return userId;
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

        this.clusterEventsManager.PublishEvent({
            type: "userSambaPasswordChanged",
            userId,
        });
    }

    public async SetUserPassword(userId: number, newPassword: string)
    {
        const cs = await this.usersController.RequestClientSecretData(userId);
        if(cs === undefined)
        {
            //user never had a password. Thus he also doesn't have a key, nor a samba pw

            const keyPair = CreateRSA4096KeyPair(newPassword);
            await this.usersController.UpdateUserKeys(userId, keyPair.privateKey, keyPair.publicKey);

            const pwSalt = this.CreateSalt();
            const pwHash = HashPassword(newPassword, pwSalt);
            await this.usersController.UpdateUserClientSecret(userId, pwHash, pwSalt);

            await this.RotateSambaPassword(userId);
        }
        else
        {
            if(!this.userWalletManager.IsUnlocked(userId))
                throw new Error("Can't change password when user is not logged in");

            //TODO: this should probably be done in a sql transaction
            throw new Error("TODO: IMPLEMENT THIS SAFELY!");
            //TODO: is this actually needed? we are not changing the private key in this case, only the password it is encrypted with... test this
            await this.userWalletManager.PrivateKeyChanged(userId, newPassword);
        }

        this.clusterEventsManager.PublishEvent({
            type: "userPasswordChanged",
            userId,
            newPassword
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