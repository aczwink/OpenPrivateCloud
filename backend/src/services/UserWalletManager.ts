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
import { UserWalletController } from "../data-access/UserWalletController";
import { UsersController } from "../data-access/UsersController";
import { Dictionary } from "acts-util-core";

 
@Injectable
export class UserWalletManager
{
    constructor(private userWalletController: UserWalletController, private usersController: UsersController)
    {
        this.privateKeys = {};
    }
    
    //Public methods
    public IsUnlocked(userId: number)
    {
        return userId in this.privateKeys;
    }

    public Lock(userId: number)
    {
        delete this.privateKeys[userId];
    }

    public async PrivateKeyChanged(userId: number, newPassword: string)
    {
        const dict: Dictionary<string> = {};
        const secretNames = await this.userWalletController.QuerySecretNames(userId);
        for (const secretName of secretNames)
        {
            dict[secretName] = await this.ReadStringSecret(userId, secretName);
        }

        await this.Unlock(userId, newPassword);

        for (const secretName of secretNames)
        {
            await this.SetStringSecret(userId, secretName, dict[secretName]!);
        }
    }

    public async ReadStringSecret(userId: number, secretName: string)
    {
        const encrypted = await this.userWalletController.QuerySecretValue(userId, secretName);
        if(encrypted === undefined)
            return undefined;

        const decrypted = this.DecryptBuffer(userId, Buffer.from(encrypted));
        return decrypted.toString("utf-8");
    }

    public async SetStringSecret(userId: number, secretName: string, secretValue: string)
    {
        const privData = await this.usersController.QueryPrivateData(userId);
        
        const encryptedData = crypto.publicEncrypt(
            {
                key: privData!.publicKey,
                padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
                oaepHash: "sha256",
            },
            Buffer.from(secretValue)
        );

        await this.userWalletController.UpdateOrInsertSecretValue(userId, secretName, encryptedData);
    }

    public async Unlock(userId: number, password: string)
    {
        const privData = await this.usersController.QueryPrivateData(userId);
        
        this.privateKeys[userId] = this.UnencryptPrivateKey(privData!.privateKey, password);
    }

    //Private state
    private privateKeys: Dictionary<string | Buffer>;

    //Private methods
    private DecryptBuffer(userId: number, secretValue: Buffer)
    {
        return crypto.privateDecrypt({
            key: this.privateKeys[userId]!,
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: "sha256"
        }, secretValue);
    }

    private UnencryptPrivateKey(encryptedPrivateKey: string, password: string)
    {
        const key = crypto.createPrivateKey({
            key: encryptedPrivateKey,
            passphrase: password
        });
        return key.export({
            type: "pkcs8",
            format: "pem"
        });
    }
}