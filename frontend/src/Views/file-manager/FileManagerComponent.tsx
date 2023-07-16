/**
 * OpenPrivateCloud
 * Copyright (C) 2019-2023 Amir Czwink (amir130@hotmail.de)
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

import { Component, Injectable, JSX_CreateElement, MatIcon, RouterState, Switch } from "acfrontend";
import { DirectoryViewComponent } from "./DirectoryViewComponent";

@Injectable
export class FileManagerComponent extends Component
{
    constructor(private routerState: RouterState)
    {
        super();

        this.showTwoColumns = false;
    }

    protected Render(): RenderValue
    {
        return <fragment>
            <div className="row evenly-spaced">
                <div className="column">
                    <Switch checked={this.showTwoColumns} onChanged={newValue => this.showTwoColumns = newValue} />
                    <MatIcon>view_week</MatIcon>
                </div>
            </div>

            <div className="row evenly-spaced">
                <div className="col"><DirectoryViewComponent resourceGroupName={this.routerState.routeParams.resourceGroupName!} instanceName={this.routerState.routeParams.instanceName!} /></div>
                {this.showTwoColumns ? <div className="col"><DirectoryViewComponent resourceGroupName={this.routerState.routeParams.resourceGroupName!} instanceName={this.routerState.routeParams.instanceName!} /></div> : null}
            </div>
        </fragment>;
    }

    //Private variables
    private showTwoColumns: boolean;
}