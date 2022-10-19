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

import { Anchor, Component, Injectable, JSX_CreateElement, MatIcon, NavItem, ProgressSpinner, RouterComponent, RouterState } from "acfrontend";
import { Dictionary } from "acts-util-core";
import { IdBoundResourceAction, RenderBoundAction } from "./IdBoundActions";

export interface ObjectType
{
    key: string;
    displayName: string;
}

interface SideNavComponentInput
{
    actions: IdBoundResourceAction<any, any, any>[];
    baseRoute: string;
    formHeading: (routeParams: Dictionary<string>) => string;
    objectTypes: ObjectType[];
}

@Injectable
export class SideNavComponent extends Component<SideNavComponentInput>
{
    constructor(private routerState: RouterState)
    {
        super();

        this.baseRoute = "";
        this.title = null;
    }
    
    protected Render(): RenderValue
    {
        if(this.title === null)
            return <ProgressSpinner />;

        return <fragment>
            <div className="row align-items-center">
                <div className="col-auto"><h2>{this.title}</h2></div>
                {...this.input.actions.map(x => <div className="col-auto">{RenderBoundAction(this.input.baseRoute, this.routerState.routeParams, x)}</div>)}
            </div>
            <div className="row">
                <div className="col-1">
                    <ul className="nav nav-pills flex-column">
                        {...this.input.objectTypes.map(x => <NavItem route={this.baseRoute + "/" + x.key}>{x.displayName}</NavItem>)}
                    </ul>
                </div>
                <div className="col"><RouterComponent /></div>
            </div>
        </fragment>;
    }

    //Private members
    private baseRoute: string;
    private title: string | null;

    //Event handlers
    override OnInitiated(): void
    {
        this.baseRoute = RouterState.ReplaceRouteParams(this.input.baseRoute, this.routerState.routeParams).join("/");
        this.title = this.input.formHeading(this.routerState.routeParams);
    }
}