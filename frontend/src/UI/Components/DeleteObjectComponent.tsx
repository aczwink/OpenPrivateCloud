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

import { Component, Injectable, JSX_CreateElement, ProgressSpinner, Router, RouterButton, RouterState } from "acfrontend";
import { Dictionary } from "acts-util-core";
import { ResponseData } from "../../../dist/api";
import { ShowErrorMessageOnErrorFromResponse } from "../ResponseHandler";

interface DeleteObjectComponentInput
{
    deleteResource: (routeParams: Dictionary<string>) => Promise<ResponseData<number, number, void>>;
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
                <RouterButton color="secondary" route={this.postDeleteURL}>Cancel</RouterButton>
            </div>
        </fragment>;
    }

    //Private variables
    private loading: boolean;

    //Private properties
    private get postDeleteURL()
    {
        const replaced = RouterState.ReplaceRouteParams(this.input.postDeleteUrl, this.routerState.routeParams);
        return replaced.join("/");
    }

    //Event handlers
    private async OnDelete()
    {
        this.loading = true;
        const response = await this.input.deleteResource(this.routerState.routeParams);
        ShowErrorMessageOnErrorFromResponse(response);

        this.router.RouteTo(this.postDeleteURL);
    }
}