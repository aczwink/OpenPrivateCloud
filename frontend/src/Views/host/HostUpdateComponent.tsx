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

import { Component, FormField, Injectable, JSX_CreateElement, ProgressSpinner, RouterState, Switch } from "acfrontend";
import { UpdateInfoDto } from "../../../dist/api";
import { APIService } from "../../Services/APIService";
import { ExtractDataFromResponseOrShowErrorMessageOnError, ShowErrorMessageOnErrorFromResponse } from "../../UI/ResponseHandler";

@Injectable
export class HostUpdateComponent extends Component
{
    constructor(private apiService: APIService, routerState: RouterState)
    {
        super();

        this.data = null;
        this.hostName = routerState.routeParams["hostName"]!;
    }
    
    protected Render(): RenderValue
    {
        if(this.data === null)
            return <ProgressSpinner />;

        return <fragment>
            <h1>System Update</h1>

            <div className="row">
                Distribution: {this.data.distributionName}
            </div>
            <div className="row">
                {this.data.updatablePackagesCount} packages can be updated.
                <button className="btn btn-primary" type="button" onclick={this.OnUpdateClicked.bind(this)}>Update now</button>
            </div>
            <FormField title="Automatically update">
                <Switch checked={this.data!.unattendedUpgradeConfig.unattendedUpgrades} onChanged={this.OnChangeUnattendedUpgradeConfig.bind(this)} />
            </FormField>
        </fragment>;
    }

    //Private variables
    private data: UpdateInfoDto | null;
    private hostName: string;

    //Private methods
    private async QueryData()
    {
        const response = await this.apiService.hosts._any_.update.get(this.hostName);
        const result = await ExtractDataFromResponseOrShowErrorMessageOnError(response);
        if(result.ok)
            this.data = result.value;
    }

    //Event handlers
    private async OnChangeUnattendedUpgradeConfig(newValue: boolean)
    {
        this.data = null;

        await this.apiService.hosts._any_.update.put(this.hostName, {
            unattendedUpgrades: newValue,
            updatePackageLists: newValue
        });

        this.QueryData();
    }

    override OnInitiated(): void
    {
        this.QueryData();
    }

    private async OnUpdateClicked()
    {
        this.data = null;
        const response = await this.apiService.hosts._any_.update.post(this.hostName);
        ShowErrorMessageOnErrorFromResponse(response);
        this.QueryData();
    }
}