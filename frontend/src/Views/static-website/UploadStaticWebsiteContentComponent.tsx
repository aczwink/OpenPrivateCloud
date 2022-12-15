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

import { Component, FileSelect, Injectable, JSX_CreateElement, ProgressSpinner, Router, RouterState } from "acfrontend";
import { resourceProviders } from "openprivatecloud-common";
import { APIService } from "../../Services/APIService";

@Injectable
export class UploadStaticWebsiteContentComponent extends Component
{
    constructor(private apiService: APIService, private routerState: RouterState, private router: Router)
    {
        super();

        this.file = null;
        this.loading = false;
    }
    
    protected Render(): RenderValue
    {
        if(this.loading)
            return <ProgressSpinner />;

        return <fragment>
            <h1>Upload Content</h1>
            <FileSelect onChanged={newValue => this.file = newValue} />
            <button type="button" disabled={this.file === null} onclick={this.OnUpload.bind(this)}>Upload</button>
        </fragment>
    }

    //Private variables
    private file: File | null;
    private loading: boolean;

    //Private methods
    private async OnUpload()
    {
        this.loading = true;
        const instanceName = this.routerState.routeParams.instanceName!;
        await this.apiService.resourceProviders.webservices.staticwebsite._any_.post(instanceName, { file: this.file! });

        this.router.RouteTo("/instances/" + resourceProviders.webServices.name + "/" + resourceProviders.webServices.staticWebsiteResourceType.name + "/" + instanceName);
    }
}