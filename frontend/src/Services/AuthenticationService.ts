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

import { Injectable, Router } from "acfrontend";
import { Property } from "acts-util-core";
import { APIService } from "./APIService";
import { APIServiceInterceptor } from "./APIServiceInterceptor";

interface LoginInfo
{
    emailAddress: string;
    expiryDateTime: Date;
    sudo: boolean;
    token: string;
}

@Injectable
export class AuthenticationService
{
    constructor(private apiService: APIService, private router: Router)
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
            
            this.apiService.token = result.token;
            this._loginInfo.Set({
                expiryDateTime: result.expiryDateTime,
                sudo: false,
                token: result.token,
                emailAddress
            });

            return true;
        }

        return false;
    }

    public async Logout()
    {
        await this.apiService.sessions.delete();
        this._loginInfo.Set(undefined);
        this.router.RouteTo("/");
    }

    //Private variables
    private _loginInfo: Property<LoginInfo | undefined>;
}