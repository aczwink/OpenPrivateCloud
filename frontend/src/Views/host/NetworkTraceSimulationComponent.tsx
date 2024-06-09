/**
 * OpenPrivateCloud
 * Copyright (C) 2024 Amir Czwink (amir130@hotmail.de)
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

import { Injectable, Component, JSX_CreateElement, FormField, Select, NumberSpinner, RouterState } from "acfrontend";
import { APIService } from "../../Services/APIService";
import { ExtractDataFromResponseOrShowErrorMessageOnError } from "../../UI/ResponseHandler";

@Injectable
export class NetworkTraceSimulationComponent extends Component
{
    constructor(private apiService: APIService, routerState: RouterState)
    {
        super();

        this.hostName = routerState.routeParams.hostName!;
        this.protocol = "TCP";
        this.port = 443;
        this.resultLog = [];
    }
    
    protected override Render(): RenderValue
    {
        return <form onsubmit={this.OnExecuteSimulation.bind(this)}>
            <div className="row">
                <div className="col">
                    <FormField title="Protocol">
                        <Select onChanged={newValue => this.protocol = newValue[0] as any}>
                            <option selected={this.protocol === "TCP"}>TCP</option>
                            <option selected={this.protocol === "UDP"}>UDP</option>
                        </Select>
                    </FormField>
                </div>
                <div className="col">
                    <FormField title="Port">
                        <NumberSpinner value={this.port} onChanged={newValue => this.port = newValue} step={1} />
                    </FormField>
                </div>
                <div className="col">
                    <button type="submit" className="btn btn-primary">Send</button>
                </div>
            </div>
            {this.RenderLog()}
        </form>;
    }

    //State
    private hostName: string;
    private protocol: "TCP" | "UDP";
    private port: number;
    private resultLog: string[];

    //Private methods
    private RenderLog()
    {
        return <table className="table table-striped table-sm">
            <thead>
                <tr>
                    <th>Log</th>
                </tr>
            </thead>
            <tbody>
                {this.resultLog.map(x => <tr>
                    <td>{x}</td>
                </tr>)}
            </tbody>
        </table>;
    }

    //Event handlers
    private async OnExecuteSimulation(event: Event)
    {
        event.preventDefault();

        const response = await this.apiService.hosts._any_.firewallTracing.simulate.put(this.hostName, { port: this.port, protocol: this.protocol });
        const result = await ExtractDataFromResponseOrShowErrorMessageOnError(response);
        if(result.ok)
            this.resultLog = result.value.log;
    }
}