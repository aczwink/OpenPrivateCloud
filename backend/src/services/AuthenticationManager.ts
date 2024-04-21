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
import { NotificationsManager } from "./NotificationsManager";
import { Duration, NumberDictionary } from "acts-util-core";
import { UsersController } from "../data-access/UsersController";
import { HashPassword } from "../common/crypto/passwords";

export type AuthMethod = "client-secret" | "email-otp";

interface MailOTP
{
    verificationCode: string;
    expiryDateTime: Date;
}
 
@Injectable
export class AuthenticationManager
{
    constructor(private notificationsManager: NotificationsManager, private usersController: UsersController)
    {
        this.mailOTP = {};
    }
    
    //Public methods
    public async Authenticate(userId: number, method: AuthMethod, password: string)
    {
        switch(method)
        {
            case "client-secret":
            {
                const user = await this.usersController.RequestClientSecretData(userId);
                if(user !== undefined)
                {
                    const expectedHash = HashPassword(password, user.pwSalt);
                    return expectedHash === user.pwHash;
                }
            }
            break;
            case "email-otp":
            {
                const generated = this.mailOTP[userId];
                if(generated !== undefined)
                    return (password === generated.verificationCode) && (generated.expiryDateTime.valueOf() > Date.now());
            }
            break;
        }
        return false;
    }

    public async DoesUserHavePassword(userId: number)
    {
        const cs = await this.usersController.RequestClientSecretData(userId);
        return (cs !== undefined);
    }

    public async ExecutePreAuthenticationStep(userId: number, method: AuthMethod)
    {
        switch(method)
        {
            case "email-otp":
            {                
                const entry = this.mailOTP[userId] = {
                    expiryDateTime: Duration.OneMinute().AddTo(new Date()),
                    verificationCode: this.CreateVerificationCode()
                };
                console.log(entry);
                const user = await this.usersController.QueryUser(userId);
                await this.notificationsManager.SendNotification(user!.emailAddress, "Verification code", "Your verification code is: " + entry.verificationCode);
            }
            break;
        }
    }

    public async RequestAuthenticationMethods(userId: number): Promise<AuthMethod[]>
    {
        const result: AuthMethod[] = [];

        if(await this.DoesUserHavePassword(userId))
            result.push("client-secret");
        if(await this.IsEMailSendingToUserPossible(userId))
            result.push("email-otp");
        
        return result;
    }

    //State
    private mailOTP: NumberDictionary<MailOTP>;

    //Private methods
    private CreateVerificationCode()
    {
        const result = [];

        for(let i = 0; i < 8; i++)
            result.push(crypto.randomInt(0, 10));
        return result.join("");
    }

    private async IsEMailSendingToUserPossible(userId: number)
    {
        return await this.notificationsManager.IsMailerConfigured();
    }
}