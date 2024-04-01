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
import { Component, Injectable, JSX_CreateElement, ProgressSpinner, RouterState } from "acfrontend";
import { PerformanceStats } from "../../../dist/api";
import { APIService } from "../../Services/APIService";
import { ExtractDataFromResponseOrShowErrorMessageOnError } from "../../UI/ResponseHandler";
import { PieChartComponent } from './PieChartComponent';
import { LineChartComponent } from './LineChartComponent';

 
@Injectable
export class HostMonitorComponent extends Component
{
    constructor(private apiService: APIService, routerState: RouterState)
    {
        super();

        this.hostName = routerState.routeParams.hostName!;
        this.stats = [];
    }
    
    protected Render(): RenderValue
    {
        if(this.stats.length === 0)
            return <ProgressSpinner />;

        const timeLabels = this.stats.map( (_, i) => "t - " + (this.stats.length - i - 1));
        const last = this.stats[this.stats.length - 1];

        const cpuData = [last.cpuUsage, 100 - last.cpuUsage];

        const usedMem = Math.round((last.totalMemory - last.availableMemory) / 1024);
        const memData = [usedMem, Math.round(last.availableMemory / 1024)];

        const diskStat = this.stats.map(x => x.diskUsage / 1024 / 1024);
        const networkStat = this.stats.map(x => x.networkUsage / 1024 / 1024);

        const pingData = this.stats.map(x => x.ping);

        return <fragment>
            <div className="row justify-content-center w-50">
                <div className="col">
                    <PieChartComponent id="cpuChart" labels={["In use", "Idle"]} data={cpuData} title={"CPU Usage"} unit={"%"} />
                </div>
                <div className="col">
                    <PieChartComponent id="memChart" labels={['In use', 'Free']} data={memData} title={"Memory"} unit={"MiB"} />
                </div>
            </div>
            <div className="row justify-content-center w-50">
                <div className="col">
                    <LineChartComponent id="diskChart" data={diskStat} labels={timeLabels} title={"Disk usage"} unit={"MiB/s"} />
                </div>
            </div>
            <div className="row justify-content-center w-50">
                <div className="col">
                    <LineChartComponent id="networkChart" data={networkStat} labels={timeLabels} title={"Network usage"} unit={'MiB/s'} />
                </div>
                <div className="col">
                    <LineChartComponent id="pingChart" data={pingData} labels={timeLabels} title={"Ping"} unit={'ms'} />
                </div>
            </div>
        </fragment>;
    }

    //Private variables
    private hostName: string;
    private stats: PerformanceStats[];
    private timerId: any;

    //Private methods
    private async LoadData()
    {
        const response = await this.apiService.hosts._any_.performance.get(this.hostName);
        const data = await ExtractDataFromResponseOrShowErrorMessageOnError(response);
        if(data.ok)
        {
            this.stats.push(data.value);
            this.Update();
        }
    }

    //Event handlers
    override async OnInitiated(): Promise<void>
    {
        await this.LoadData();
        this.timerId = setInterval(this.LoadData.bind(this), 5000);
    }

    override OnUnmounted(): void
    {
        clearInterval(this.timerId);
    }
}