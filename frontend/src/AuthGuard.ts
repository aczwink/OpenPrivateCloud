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
import { AbsURL } from "acts-util-core";
import { RouteGuard, Injectable, Router, RouterState } from "acfrontend";

import { AuthenticationService } from "./Services/AuthenticationService";

@Injectable
export class AuthGuard implements RouteGuard
{
    constructor(private authenticationService: AuthenticationService, private router: Router)
    {
    }

    //Public methods
    public CanActivate()
    {
        if(this.authenticationService.IsLoggedIn())
            return true;
        return false;
    }

    public OnActivationFailure(routerState: RouterState)
    {
        const url = RouterState.CreateAbsoluteUrl("/login");
        this.router.RouteTo( new AbsURL({
            host: url.host,
            path: url.path,
            port: url.port,
            protocol: url.protocol,
            queryParams: { returnUrl: routerState.ToUrl().PathAndQueryToString() }
        }));
    }
}