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

import { Component, FormField, Injectable, JSX_CreateElement, LineEdit } from "acfrontend";
import { APIService } from "../../Services/APIService";
import { AuthenticationService } from "../../Services/AuthenticationService";

 
@Injectable
export class ChangeUserPasswordComponent extends Component
{
    constructor(private apiService: APIService, private authService: AuthenticationService)
    {
        super();

        this.oldPw = "";
        this.newPw = "";
        this.confirmPw = "";
    }
    
    protected Render(): RenderValue
    {
        const doPwsMatch = this.newPw === this.confirmPw;

        return <form onsubmit={this.OnSubmit.bind(this)}>
            <h2>Change password</h2>
            <FormField title="Old password">
                <LineEdit password={true} value={this.oldPw} onChanged={newValue => this.oldPw = newValue} />
            </FormField>
            <FormField title="New password">
                <LineEdit password={true} value={this.newPw} onChanged={newValue => this.newPw = newValue} />
            </FormField>
            <FormField title="Confirm new password">
                <fragment>
                    <LineEdit className={doPwsMatch ? undefined : "is-invalid"} password={true} value={this.confirmPw} onChanged={newValue => this.confirmPw = newValue} />
                    {doPwsMatch ? null : <div className="invalid-feedback">Passwords don't match</div>}
                </fragment>
            </FormField>
            <button className="btn btn-primary" disabled={!doPwsMatch} type="submit">Submit</button>
        </form>;
    }

    //Private variables
    private oldPw: string;
    private newPw: string;
    private confirmPw: string;

    //Event handlers
    private async OnSubmit(event: Event)
    {
        event.preventDefault();

        await this.apiService.user.post({
            oldPw: this.oldPw,
            newPw: this.newPw
        });

        alert("Password updated. You will be logged out now.");
        this.authService.Logout();
    }
}