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

import { BootstrapIcon, Component, Injectable, JSX_CreateElement, Navigation, NavItem, RouterComponent } from "acfrontend";
import { AuthenticationService } from "./Services/AuthenticationService";
import { SessionComponent } from "./SessionComponent";
import { MainComponent } from "./MainComponent";

@Injectable
export class RootComponent extends Component
{
    constructor(private authenticationService: AuthenticationService)
    {
        super();

        this.isLoggedIn = this.authenticationService.IsLoggedIn();
    }
    
    protected Render()
    {
        if(!this.isLoggedIn)
            return <RouterComponent />;
            
        return <fragment>
            {this.RenderNav()}
            <div className="container-fluid"><MainComponent/></div>
        </fragment>;
    }

    //Private variables
    private isLoggedIn: boolean;

    //Private methods
    private RenderNav()
    {
        return <Navigation>
            <ul className="nav nav-pills">
                <NavItem route="/"><BootstrapIcon>speedometer2</BootstrapIcon> Dashboard</NavItem>
                <NavItem route="/resources"><BootstrapIcon>collection</BootstrapIcon> Resources</NavItem>
                <NavItem route="/resourceGroups"><BootstrapIcon>collection-fill</BootstrapIcon> Resource groups</NavItem>
                <NavItem route="/dataExplorer"><BootstrapIcon>graph-up-arrow</BootstrapIcon> Data Explorer</NavItem>
                <NavItem route="/usersandgroups"><BootstrapIcon>people-fill</BootstrapIcon> IAM</NavItem>
            </ul>
            <ul className="nav nav-pills">
                <NavItem route="/hosts"><BootstrapIcon>pc</BootstrapIcon> Hosts</NavItem>
                <NavItem route="/cluster"><BootstrapIcon>gear-fill</BootstrapIcon> Cluster settings</NavItem>
            </ul>
            <SessionComponent />
        </Navigation>;
    }

    //Event handlers
    override OnInitiated(): void
    {
        this.authenticationService.loginInfo.Subscribe(newValue => this.isLoggedIn = (newValue !== undefined));
        this.authenticationService.TryAutoLogin();
    }
}