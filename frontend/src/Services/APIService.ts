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
import { API } from "../../dist/api";

import { APIServiceBase, HTTPInterceptor, HTTPService, Injectable } from "acfrontend";

export const BACKEND_PORT = 8078;
export const BACKEND_HOSTNAME = window.location.hostname;
export const BACKEND_HOST = BACKEND_HOSTNAME + ":" + BACKEND_PORT;

@Injectable
export class APIService extends API
{
    constructor(httpService: HTTPService)
    {
        super( req => this.base.SendRequest(req) );

        this.base = new APIServiceBase(httpService, BACKEND_HOSTNAME, BACKEND_PORT, "https");
    }

    //Properties    
    public set token(token: string)
    {
        this.base.globalHeaders.Authorization = "Bearer " + token;
    }

    //Public methods
    public RegisterInterceptor(interceptor: HTTPInterceptor)
    {
        this.base.RegisterInterceptor(interceptor);
    }

    //Private variables
    private base: APIServiceBase;
}