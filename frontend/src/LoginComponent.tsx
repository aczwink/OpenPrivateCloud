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
import {Component, JSX_CreateElement, LineEdit, Injectable, Router, ProgressSpinner, BootstrapIcon} from "acfrontend";
import { AuthenticationService } from "./Services/AuthenticationService";
import { APIService } from "./Services/APIService";
import { PublicClusterSettings } from "../dist/api";

enum LoginState
{
    NoUser,
    UserSelected
}

@Injectable
export class LoginComponent extends Component
{
    constructor(private authenticationService: AuthenticationService, private router: Router, private apiService: APIService)
    {
        super();

        this.publicSettings = null;
        this.state = LoginState.NoUser;
        this.emailAddress = "";
        this.password = "";
        this.failed = false;
    }
    
    //Protected methods
    protected Render(): RenderValue
    {
        if(this.publicSettings === null)
            return <ProgressSpinner />;

        return <div className="container text-center">
            <h1 className="my-3">Welcome to {this.publicSettings.name}</h1>
            {this.RenderState()}
            {this.RenderFailureMessage()}
        </div>;
    }

    //Private members
    private publicSettings: PublicClusterSettings | null;
    private state: LoginState;
    private emailAddress: string;
    private password: string;
    private failed: boolean;

    //Private methods
    private RenderPasswordAuth()
    {
        return <form onsubmit={this.OnLogin.bind(this)}>
            <h3 className="my-3">Signing in {this.emailAddress}</h3>
            <h3 className="text-start text-primary"><a onclick={() => this.state = LoginState.NoUser} role="button"><BootstrapIcon>arrow-left</BootstrapIcon></a></h3>
            <input type="text" value={this.emailAddress} className="d-none" />
            <div className="form-floating">
                <LineEdit value={this.password} password onChanged={newValue => this.password = newValue} />
                <label>Password</label>
                <button className="btn btn-primary btn-lg mt-3" type="submit">Sign in</button>
            </div>
        </form>;
    }

    private RenderFailureMessage()
    {
        if(this.failed)
        {
            return "Invalid login";
        }
        return null;
    }

    private RenderState()
    {
        switch(this.state)
        {
            case LoginState.NoUser:
                return this.RenderUsersSelection();
            case LoginState.UserSelected:
                //TODO: render auth methods
                return this.RenderPasswordAuth();
        }
    }

    private RenderUsersSelection()
    {
        const sessions = this.authenticationService.QuerySavedSessions();
        const newestSession = sessions.Values().Map(x => x!.expiryDateTime.valueOf()).Reduce( (a, b) => Math.max(a, b), 0);

        return <fragment>
            <h3 className="my-3">Please sign in</h3>
            <div className="list-group">
                {sessions.Entries().OrderBy(kv => kv.key).Map(kv => this.RenderUserSession(kv.key.toString(), kv.value!.expiryDateTime, newestSession)).ToArray()}
            </div>
            <h5 className="my-4">OR</h5>
            <div className="form-floating">
                <LineEdit value={this.emailAddress} onChanged={newValue => this.emailAddress = newValue} />
                <label>E-Mail address</label>
            </div>
            <button className="btn btn-primary btn-lg mt-3" type="button" onclick={this.OnAddNewUser.bind(this)}>Sign in</button>
        </fragment>;
    }

    private RenderUserSession(emailAddress: string, expiryDateTime: number, newestSession: number)
    {
        const isSessionActive = expiryDateTime > Date.now();
        const signedIn = (isSessionActive) ? <fragment><br />Signed in</fragment> : null;
        const highlight = (isSessionActive && (expiryDateTime === newestSession)) ? " active" : "";
        return <button type="button" className={"list-group-item list-group-item-action" + highlight} onclick={this.OnSelectSessionOrUser.bind(this, emailAddress)}>
            <span className="fw-bold">{emailAddress}</span>
            <span className="small">{signedIn}</span>
        </button>;
    }

    //Event handlers
    private OnAddNewUser()
    {
        this.state = LoginState.UserSelected;
    }

    override async OnInitiated(): Promise<void>
    {
        const response = await this.apiService.cluster.config.settings.get();
        this.publicSettings = response.data;
    }

    private async OnLogin(event: Event)
    {
        event.preventDefault();
        event.stopPropagation();
        
        if(await this.authenticationService.Login(this.emailAddress, this.password))
            this.OnSessionAcquired();
        else
            this.failed = true;
    }

    private async OnSelectSessionOrUser(eMailAddress: string)
    {
        const session = this.authenticationService.QuerySavedSessions()[eMailAddress];
        if( (session !== undefined) && (session.expiryDateTime > Date.now()) )
        {
            await this.authenticationService.SetSession(session.token, new Date(session.expiryDateTime));
            this.OnSessionAcquired();
        }
        else
        {
            this.emailAddress = eMailAddress;
            this.state = LoginState.UserSelected;
        }
    }

    private OnSessionAcquired()
    {
        const returnUrl = this.router.state.Get().queryParams.returnUrl || "/";
        this.router.RouteTo(returnUrl);
    }
}