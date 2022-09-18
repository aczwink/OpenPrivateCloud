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

import { Dictionary } from "acts-util-core";
import { Injectable } from "acts-util-node";
import { UsersController } from "../dataaccess/UsersController";

interface Session
{
    expiryDateTime: Date;
    timerId?: NodeJS.Timeout;
}

@Injectable
export class SessionsManager
{
    constructor(private usersController: UsersController)
    {
        this.sessions = {};
    }

    //Public methods
    public GetSession(token: string)
    {
        const session = this.sessions[token];
        return session;
    }

    public async LogOut(token: string)
    {
        delete this.sessions[token];
    }

    public async TryCreateSession(emailAddress: string, password: string)
    {
        const user = await this.usersController.QueryUser(emailAddress);
        if(user === undefined)
            return null;

        const expectedHash = crypto.scryptSync(password, user.pwSalt, 32).toString("hex");
        if(expectedHash === user.pwHash)
        {
            const token = await this.CreateToken();
            const session = this.sessions[token] = {
                expiryDateTime: this.CreateExpiryTime(),
            };
            this.SetAutoLogOutTimer(token, session);
            return { expiryDateTime: session.expiryDateTime, token };
        }
        return null;
    }

    //Private variables
    private sessions: Dictionary<Session>;

    //Private methods
    private AutoLogOut(token: string)
    {
        const session = this.sessions[token];
        if(session === undefined)
            return;

        if(new Date() >= session.expiryDateTime)
            this.LogOut(token);
        else
            this.SetAutoLogOutTimer(token, session);
    }

    private CreateExpiryTime()
    {
        const minutes = 10;
        const t = minutes * 60 * 1000;

        return new Date( Date.now() + t );
    }

    private CreateSalt()
    {
        return crypto.randomBytes(16);
    }

    private CreateToken()
    {
        return new Promise<string>( (resolve, reject) =>
        {
            crypto.randomBytes(8, (error, data) => {
                if (error) reject(error);

                resolve(data.toString("base64"));
            });
        });
    }

    private SetAutoLogOutTimer(token: string, session: Session)
    {
        session.timerId = setTimeout(this.AutoLogOut.bind(this, token), session.expiryDateTime.valueOf() - Date.now());
    }
}