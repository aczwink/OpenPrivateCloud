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
import { AuthMethod, PublicClusterSettings } from "../../dist/api";
import { AuthenticationService } from "../services/AuthenticationService";
import { ObjectExtensions } from "acts-util-core";
import { APIService } from "../services/APIService";
import { APIResponseHandler } from "acfrontendex";

enum LoginState
{
    NoUser,
    UserSelected,
    AuthMethodSelected
}

@Injectable
export class LoginComponent extends Component
{
    constructor(private authenticationService: AuthenticationService, private router: Router, private apiService: APIService, private apiResponseHandler: APIResponseHandler)
    {
        super();

        this.publicSettings = null;
        this.state = LoginState.NoUser;
        this.authMethods = null;
        this.selectedAuthMethod = "client-secret";
        this.emailAddress = "";
        this.password = "";
        this.failed = false;
    }
    
    //Protected methods
    protected Render(): RenderValue
    {
        if((this.publicSettings === null))
        {
            if(this.failed)
                return <h1>Error: Backend is not reachable!</h1>;
            return <ProgressSpinner />;
        }

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
    private authMethods: AuthMethod[] | null;
    private selectedAuthMethod: AuthMethod;
    private password: string;
    private failed: boolean;

    //Private methods
    private RenderAuthMethod(method: AuthMethod)
    {
        const highlight = (method === "client-secret") ? " active" : "";
        return <button type="button" className={"list-group-item list-group-item-action" + highlight} onclick={this.OnSelectAuthMethod.bind(this, method)}>
            {this.RenderAuthMethodContent(method)}
        </button>;
    }

    private RenderAuthMethodContent(method: AuthMethod)
    {
        switch(method)
        {
            case "client-secret":
                return "Password";
            case "email-otp":
                return "One-Time-Passcode via E-Mail";
        }
    }

    private RenderAuthMethods()
    {
        if(this.authMethods === null)
            return <ProgressSpinner />;
        if(this.authMethods.length === 0)
        {
            return <fragment>
                <h3 className="my-3 text-danger">This user can not authenticate!</h3>
                <h3 className="text-primary"><a onclick={() => this.state = LoginState.NoUser} role="button"><BootstrapIcon>arrow-left</BootstrapIcon> Go back</a></h3>
            </fragment>;
        }

        return <fragment>
            <h3 className="my-3">Please select how you want to authenticate</h3>
            <h3 className="text-start text-primary"><a onclick={() => this.state = LoginState.NoUser} role="button"><BootstrapIcon>arrow-left</BootstrapIcon></a></h3>
            <div className="list-group">
                {this.authMethods.map(this.RenderAuthMethod.bind(this))}
            </div>
        </fragment>;
    }

    private RenderAuthMethodChallenge()
    {
        switch(this.selectedAuthMethod)
        {
            case "client-secret":
                return this.RenderPasswordAuth();
            case "email-otp":
                return this.RenderEmailOTPAuth();
        }
    }

    private RenderEmailOTPAuth()
    {
        return <form onsubmit={this.OnLogin.bind(this)}>
            <h3 className="my-3">Signing in {this.emailAddress}</h3>
            <h3 className="text-start text-primary"><a onclick={() => this.state = LoginState.UserSelected} role="button"><BootstrapIcon>arrow-left</BootstrapIcon></a></h3>
            <div>Verification code has been sent to {this.emailAddress}. Check your mailbox!</div>
            <input type="text" value={this.emailAddress} className="d-none" />
            <div className="form-floating">
                <LineEdit value={this.password} onChanged={newValue => this.password = newValue} />
                <label>Verification code</label>
                <button className="btn btn-primary btn-lg mt-3" type="submit">Sign in</button>
            </div>
        </form>;
    }

    private RenderPasswordAuth()
    {
        return <form onsubmit={this.OnLogin.bind(this)}>
            <h3 className="my-3">Signing in {this.emailAddress}</h3>
            <h3 className="text-start text-primary"><a onclick={() => this.state = LoginState.UserSelected} role="button"><BootstrapIcon>arrow-left</BootstrapIcon></a></h3>
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
                return this.RenderAuthMethods();
            case LoginState.AuthMethodSelected:
                return this.RenderAuthMethodChallenge();
        }
    }

    private RenderUsersSelection()
    {
        const sessions = this.authenticationService.QuerySavedSessions();
        const newestSession = (ObjectExtensions.Values(sessions).Any()) ? ObjectExtensions.Values(sessions).Map(x => x!.expiryDateTime.valueOf()).Max() : Number.NaN;

        return <fragment>
            <h3 className="my-3">Please sign in</h3>
            <div className="list-group">
                {ObjectExtensions.Entries(sessions).OrderBy(kv => kv.key).Map(kv => this.RenderUserSession(kv.key.toString(), kv.value!.expiryDateTime, newestSession)).ToArray()}
            </div>
            {ObjectExtensions.Values(sessions).Any() ? <h5 className="my-4">OR</h5> : null}
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
            {isSessionActive ? <a className="text-warning text-end" onclick={this.OnLogoutSession.bind(this, emailAddress)}><BootstrapIcon>door-open-fill</BootstrapIcon></a> : null}
            {<a className="text-danger text-end" onclick={this.OnDeleteUser.bind(this, emailAddress)}><BootstrapIcon>trash</BootstrapIcon></a>}
        </button>;
    }

    //Event handlers
    private OnAddNewUser()
    {
        this.OnSelectSessionOrUser(this.emailAddress);
    }

    private OnDeleteUser(emailAddress: string, event: Event)
    {
        event.preventDefault();
        event.stopPropagation();

        this.authenticationService.RemoveUser(emailAddress);
        this.Update();
    }

    private OnLogoutSession(emailAddress: string, event: Event)
    {
        event.preventDefault();
        event.stopPropagation();

        this.authenticationService.RemoveSession(emailAddress);
        this.Update();
    }

    override async OnInitiated(): Promise<void>
    {
        try
        {
            const response = await this.apiService.public.clusterSettings.get();
            this.publicSettings = response.data;
        }
        catch(e)
        {
            this.failed = true;
        }
    }

    private async OnLogin(event: Event)
    {
        event.preventDefault();
        event.stopPropagation();
        
        if(await this.authenticationService.Login(this.emailAddress, this.selectedAuthMethod, this.password))
        {
        }
        else
            this.failed = true;
    }

    private OnSelectAuthMethod(method: AuthMethod)
    {
        this.selectedAuthMethod = method;
        this.state = LoginState.AuthMethodSelected;

        if(method === "email-otp")
            this.apiService.public.preAuth.post({ authMethod: method, userName: this.emailAddress });
    }

    private async OnSelectSessionOrUser(eMailAddress: string)
    {
        const session = this.authenticationService.QuerySavedSessions()[eMailAddress];
        if( (session !== undefined) && (session.expiryDateTime > Date.now()) )
            await this.authenticationService.SetSession(session.token, new Date(session.expiryDateTime));
        else
        {
            this.authMethods = null;
            this.state = LoginState.UserSelected;

            const response = await this.apiService.public.authMethods.get({ userName: eMailAddress });
            const result = await this.apiResponseHandler.ExtractDataFromResponseOrShowErrorMessageOnError(response);
            if(result.ok)
            {
                this.emailAddress = eMailAddress;
                this.authMethods = result.value;
                if(this.authMethods.length === 1)
                    this.OnSelectAuthMethod(this.authMethods[0]);
            }
            else
            {
                this.state = LoginState.NoUser;
                this.failed = true;
            }
        }
    }
}