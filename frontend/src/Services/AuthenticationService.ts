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

import { CookieService, Injectable, Router } from "acfrontend";
import { Dictionary, Duration, Property } from "acts-util-core";
import { APIService } from "./APIService";
import { APIServiceInterceptor } from "./APIServiceInterceptor";
import { PublicUserData } from "../../dist/api";

interface LoginInfo
{
    expiryDateTime: Date;
    token: string;
    user: PublicUserData;
}

interface SessionCookieEntry
{
    expiryDateTime: number;
    token: string;
}

@Injectable
export class AuthenticationService
{
    constructor(private apiService: APIService, private router: Router, private cookieService: CookieService)
    {
        this._loginInfo = new Property<LoginInfo | undefined>(undefined);

        this.apiService.RegisterInterceptor(new APIServiceInterceptor(this.Logout.bind(this)));
    }

    //Properties
    public get loginInfo()
    {
        return this._loginInfo;
    }
    
    //Public methods
    public GetRemainingLoginTime()
    {
        const li = this._loginInfo.Get();
        if(li === undefined)
            return new Duration(0);

        return new Duration(Math.max(li.expiryDateTime.valueOf() - Date.now(), 0));
    }

    public IsLoggedIn()
    {
        return this._loginInfo.Get() !== undefined;
    }

    public async Login(emailAddress: string, password: string)
    {
        const response = await this.apiService.sessions.post({ emailAddress, password });
        if(response.statusCode === 200)
        {
            const result = response.data;
            await this.SetSession(result.token, result.expiryDateTime)

            return true;
        }

        return false;
    }

    public async Logout()
    {
        if(this.IsLoggedIn())
        {
            const session = this._loginInfo.Get();
            // to prevent loops, do this first
            this._loginInfo.Set(undefined);
            this.router.RouteTo("/");
            this.RemoveSession(session!.user.emailAddress);

            clearTimeout(this.autoLogOutTimerId);
            this.autoLogOutTimerId = undefined;

            await this.apiService.sessions.delete();
        }
    }

    public QuerySavedSessions()
    {
        const sessions = this.ReadSessionCookie();
        return sessions;
    }

    public async SetSession(token: string, expiryDateTime: Date)
    {
        this.apiService.token = token;

        const userResponse = await this.apiService.user.get();
        this._loginInfo.Set({
            expiryDateTime: expiryDateTime,
            token: token,
            user: userResponse.data
        });
        this.SaveSession(userResponse.data.emailAddress, token, expiryDateTime);

        this.autoLogOutTimerId = setTimeout(this.Logout.bind(this), this.GetRemainingLoginTime().milliseconds);
    }

    //Private variables
    private _loginInfo: Property<LoginInfo | undefined>;
    private autoLogOutTimerId?: any;

    //Private methods
    private ReadSessionCookie()
    {
        const sessionsString = this.cookieService.Get("sessions");
        const sessions = (sessionsString === undefined) ? {} : JSON.parse(sessionsString) as Dictionary<SessionCookieEntry>;
        return sessions;
    }

    private RemoveSession(emailAddress: string)
    {
        const sessions = this.ReadSessionCookie();
        const session = sessions[emailAddress];
        if(session !== undefined)
        {
            session.expiryDateTime = 0;
            this.WriteSessionCookie(sessions);
        }
    }

    private SaveSession(emailAddress: string, token: string, expiryDateTime: Date)
    {
        const sessions = this.ReadSessionCookie();
        sessions[emailAddress] = { expiryDateTime: expiryDateTime.valueOf(), token };
        this.WriteSessionCookie(sessions);
    }

    private WriteSessionCookie(sessions: Dictionary<SessionCookieEntry>)
    {
        this.cookieService.Set("sessions", JSON.stringify(sessions));
    }
}