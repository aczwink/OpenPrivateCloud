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

import { Anchor, BootstrapIcon, Component, Injectable, JSX_CreateElement, ProgressSpinner, RouterState } from "acfrontend";
import { ProcessDto } from "../../../dist/api";
import { APIService } from "../../Services/APIService";
import { ExtractDataFromResponseOrShowErrorMessageOnError, ShowErrorMessageOnErrorFromResponse } from "../../UI/ResponseHandler";

@Injectable
export class ViewProcessesListComponent extends Component
{
    constructor(private apiService: APIService, private routerState: RouterState)
    {
        super();

        this.processes = null;
    }
    
    protected Render(): RenderValue
    {
        if(this.processes === null)
            return <ProgressSpinner />;

        return <fragment>
            <h2>Processes <a className="text-primary" role="button" onclick={this.LoadData.bind(this)}><BootstrapIcon>arrow-repeat</BootstrapIcon></a></h2>
            <table className="table">
                <thead>
                    <tr>
                        <th>Status</th>
                        <th>Title</th>
                        <th>Host</th>
                        <th>Start time</th>
                    </tr>
                </thead>
                <tbody>
                    {this.processes.map(this.RenderProcess.bind(this))}
                </tbody>
            </table>
        </fragment>;
    }

    //Private variables
    private processes: ProcessDto[] | null;

    //Private methods
    private async LoadData()
    {
        this.processes = null;

        const hostName = this.routerState.routeParams.hostName!;
        const response = await this.apiService.hosts._any_.processes.get(hostName);
        const result = ExtractDataFromResponseOrShowErrorMessageOnError(response);
        if(result.ok)
        {
            this.processes = result.value.Values().OrderByDescending(x => x.startTime.valueOf()).ToArray();
        }
    }

    private RenderProcess(process: ProcessDto)
    {
        return <tr>
            <td>{this.RenderStatus(process.status)}</td>
            <td><Anchor route={"/activitymonitor/" + process.id}>{process.title}</Anchor></td>
            <td><Anchor route={"/hosts/" + process.hostName}>{process.hostName}</Anchor></td>
            <td>{process.startTime.toLocaleString()}</td>
        </tr>;
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