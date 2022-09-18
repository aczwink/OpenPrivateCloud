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

import { Component, Injectable, JSX_CreateElement, ProgressSpinner, Router, RouterButton, RouterState } from "acfrontend";
import { Dictionary } from "acts-util-core";

interface DeleteObjectComponentInput
{
    deleteResource: (routeParams: Dictionary<string>) => Promise<void>;
    postDeleteUrl: string;
}

@Injectable
export class DeleteObjectComponent extends Component<DeleteObjectComponentInput>
{
    constructor(private routerState: RouterState, private router: Router)
    {
        super();

        this.loading = false;
    }

    protected Render(): RenderValue
    {
        if(this.loading)
            return <ProgressSpinner />;

        return <fragment>
            Are you sure that you PERMANENTLY want to delete this?
            <br />
            <div className="btn-group">
                <button type="button" className="btn btn-danger" onclick={this.OnDelete.bind(this)}>Delete</button>
                <RouterButton className="btn btn-secondary" route={this.input.postDeleteUrl}>Cancel</RouterButton>
            </div>
        </fragment>;
    }

    //Private variables
    private loading: boolean;

    //Event handlers
    private async OnDelete()
    {
        this.loading = true;
        await this.input.deleteResource(this.routerState.routeParams);

        const replaced = RouterState.ReplaceRouteParams(this.input.postDeleteUrl, this.routerState.routeParams);
        this.router.RouteTo(replaced.join("/"));
    }
}