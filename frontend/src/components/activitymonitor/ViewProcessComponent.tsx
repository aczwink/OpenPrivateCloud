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

import { Anchor, BootstrapIcon, Component, Injectable, JSX_CreateElement, ProgressSpinner, RouterState } from "acfrontend";
import { ProcessTrackerReadOnlyWithId } from "../../../dist/api";
import { APIService } from "../../services/APIService";
import { APIResponseHandler } from "acfrontendex";

@Injectable
export class ViewProcessComponent extends Component
{
    constructor(private apiService: APIService, private routerState: RouterState, private apiResponseHandler: APIResponseHandler)
    {
        super();

        this.data = null;
    }
    
    protected Render(): RenderValue
    {
        if(this.data === null)
            return <ProgressSpinner />;

        return <fragment>
            <h2>{this.data.title} <a className="text-primary" role="button" onclick={this.LoadData.bind(this)}><BootstrapIcon>arrow-repeat</BootstrapIcon></a></h2>
            <table className="table">
                <thead>
                    <tr>
                        <th>Key</th>
                        <th>Value</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>Start time</td>
                        <td>{this.data.startTime.toLocaleString()}</td>
                    </tr>
                    <tr>
                        <td>Host</td>
                        <td><Anchor route={"/hosts/" + this.data.hostName}>{this.data.hostName}</Anchor></td>
                    </tr>
                    <tr>
                        <td>Status</td>
                        <td>{this.RenderStatus(this.data.status)}</td>
                    </tr>
                    <tr>
                        <td colSpan="2">
                            <textarea className="form-control" cols="80" rows="24" readOnly>{this.data.fullText}</textarea>
                        </td>
                    </tr>
                </tbody>
            </table>
        </fragment>;
    }

    //Private variables
    private data: ProcessTrackerReadOnlyWithId | null;

    //Private methods
    private async LoadData()
    {
        this.data = null;
        
        const response = await this.apiService.processes.info.get({ processId: parseInt(this.routerState.routeParams.processId!) });
        const result = await this.apiResponseHandler.ExtractDataFromResponseOrShowErrorMessageOnError(response);
        if(result.ok)
            this.data = result.value;
    }

    private RenderStatus(status: number)
    {
        switch(status)
        {
            case 1:
                return <div className="text-success"><BootstrapIcon>check-circle-fill</BootstrapIcon></div>;
            case 2:
                return <div className="text-danger"><BootstrapIcon>x-circle-fill</BootstrapIcon></div>;
        }
        return <div className="text-info"><BootstrapIcon>arrow-repeat</BootstrapIcon></div>;
    }

    //Event handlers
    override OnInitiated(): void
    {
        this.LoadData();
    }
}