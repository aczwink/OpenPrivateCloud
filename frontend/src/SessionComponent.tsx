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

import { Anchor, Component, Injectable, JSX_CreateElement, MatIcon } from "acfrontend";
import { AuthenticationService } from "./Services/AuthenticationService";

@Injectable
export class SessionComponent extends Component
{
    constructor(private authService: AuthenticationService)
    {
        super();
    }
    
    protected Render(): RenderValue
    {
        const li = this.authService.loginInfo.Get();
        if(li === undefined)
            return null;

        const left = this.authService.GetRemainingLoginTime();

        return <div className="d-flex align-items-center">
            Welcome, {li.user.firstName}!
            <Anchor route="/usersettings"><MatIcon>account_circle</MatIcon></Anchor>
            <button className="ms-2 btn btn-danger btn-sm" type="button" onclick={this.OnLogOut.bind(this)}>Sign out ({left.ToStringWithSecondPrecision()})</button>
        </div>;
    }

    //Private variables
    private timerId?: any;

    //Event handlers
    override OnInitiated(): void
    {
        this.timerId = setInterval(this.Update.bind(this), 1000);
    }

    private OnLogOut()
    {
        this.authService.Logout();
    }

    override OnUnmounted(): void
    {
        clearInterval(this.timerId);
    }
}
