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

import { BootstrapIcon, Component, Injectable, JSX_CreateElement, ProgressSpinner } from "acfrontend";
import { ClusterHealthStats, HealthStats, HealthStatus } from "../../dist/api";
import { APIService } from "../services/APIService";

@Injectable
export class DashboardComponent extends Component
{
    constructor(private apiService: APIService)
    {
        super();

        this.stats = null;
    }

    protected Render(): RenderValue
    {
        if(this.stats === null)
            return <ProgressSpinner />;

        return <fragment>
            <h2>Health of cluster</h2>
            <div className="row">
                <div className="col">
                    <h3 className="text-center">Instances</h3>
                    {this.RenderSummaryIcon(this.stats.instancesHealth)}
                    {this.RenderStats(this.stats.instancesHealth)}
                </div>
                <div className="col">
                    <h3 className="text-center">Hosts</h3>
                    {this.RenderSummaryIcon(this.stats.hostsHealth)}
                    {this.RenderStats(this.stats.hostsHealth)}
                </div>
            </div>
        </fragment>;
    }

    //Private variables
    private stats: ClusterHealthStats | null;

    //Private methods
    private RenderStats(stats: HealthStats[])
    {
        return <table className="table table-striped">
            <thead>
                <tr>
                    <th>Status</th>
                    <th>Count</th>
                </tr>
            </thead>
            <tbody>
                {stats.map(x => <tr>
                    <td>{this.RenderStatus(x.status)}</td>
                    <td>{x.cnt}</td>
                </tr>)}
            </tbody>
        </table>;
    }

    private RenderStatus(status: HealthStatus)
    {
        switch(status)
        {
            case HealthStatus.Corrupt:
                return <div className="text-danger"><BootstrapIcon>x-circle-fill</BootstrapIcon></div>;
            case HealthStatus.Down:
                return <div className="text-warning"><BootstrapIcon>exclamation-circle-fill</BootstrapIcon></div>;
            case HealthStatus.Up:
                return <div className="text-success"><BootstrapIcon>check-circle-fill</BootstrapIcon></div>;
            case HealthStatus.InDeployment:
                return <div className="text-danger"><BootstrapIcon>hourglass-split</BootstrapIcon></div>;
        }
    }

    private RenderSummaryIcon(stats: HealthStats[])
    {
        const maxProblem = stats.Values()
            .Filter(x => x.status !== HealthStatus.Up)
            .Filter(x => x.cnt > 0)
            .Map(x => x.status)
            .OrderByDescending(x => x)
            .FirstOrUndefined()

        const summaryStatus = maxProblem ?? HealthStatus.Up;

        return <h1 className="text-center">{this.RenderStatus(summaryStatus)}</h1>
    }

    //Event handlers
    override async OnInitiated(): Promise<void>
    {
        const response = await this.apiService.health.get();

        this.stats = response.data;
    }
}