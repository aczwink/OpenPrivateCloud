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

import { Dictionary } from "acts-util-core";
import { DateTime, Injectable } from "acts-util-node";
import { ClusterEventsManager } from "./ClusterEventsManager";

interface Session
{
    expiryDateTime: DateTime;
    timerId?: NodeJS.Timeout;
    userId: number;
}

@Injectable
export class SessionsManager
{
    constructor(private clusterEventsManager: ClusterEventsManager)
    {
        this.sessions = {};
    }

    //Public methods
    public async CreateSession(userId: number)
    {
        const token = await this.CreateToken();
        const session = this.sessions[token] = {
            expiryDateTime: this.CreateExpiryTime(),
            userId: userId,
        };

        this.SetAutoLogOutTimer(token, session);

        this.clusterEventsManager.PublishEvent({
            type: "userLogIn",
            userId,
        });

        return { expiryDateTime: session.expiryDateTime, token };
    }

    public GetSession(token: string)
    {
        const session = this.sessions[token];
        return session;
    }

    public GetUserIdFromAuthHeader(authorization: string): number
    {
        const token = authorization.substring(7);
        return this.sessions[token]!.userId;
    }

    public async LogOut(token: string)
    {
        const session = this.GetSession(token);

        delete this.sessions[token];

        if(session !== undefined)
        {
            this.clusterEventsManager.PublishEvent({
                type: "userLogOut",
                userId: session.userId
            });
        }
    }

    //Private variables
    private sessions: Dictionary<Session>;

    //Private methods
    private AutoLogOut(token: string)
    {
        const session = this.sessions[token];
        if(session === undefined)
            return;

        if(DateTime.Now().IsAfter(session.expiryDateTime))
            this.LogOut(token);
        else
            this.SetAutoLogOutTimer(token, session);
    }

    private CreateExpiryTime()
    {
        const minutes = 10;
        return DateTime.Now().Add({ count: minutes, unit: "minutes" });
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
        session.timerId = setTimeout(this.AutoLogOut.bind(this, token), session.expiryDateTime.millisecondsSinceEpoch - Date.now());
    }
}