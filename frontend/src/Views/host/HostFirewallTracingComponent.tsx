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
import { Component, Injectable, JSX_CreateElement, ProgressSpinner, RouterState } from "acfrontend";
import { APIService } from "../../Services/APIService";
import { ExtractDataFromResponseOrShowErrorMessageOnError } from "../../UI/ResponseHandler";
import { FirewallDebugSettings, PacketCaptureInfo } from "../../../dist/api";
import { ObjectEditorComponent } from "../../UI/Components/ObjectEditorComponent";
import { APISchemaService } from "../../Services/APISchemaService";

 
@Injectable
export class HostFirewallTracingComponent extends Component
{
    constructor(private apiService: APIService, routerState: RouterState, private apiSchemaService: APISchemaService)
    {
        super();

        this.hostName = routerState.routeParams.hostName!;
        this.settings = null;
        this.packets = [];
        this.timerId = null;
        this.loadingPackets = false;
    }
    
    protected override Render(): RenderValue
    {
        if(this.settings === null)
            return <ProgressSpinner />;

        return <fragment>
            {this.RenderSettings(this.settings)}
            {this.RenderButtons()}
            <hr />
            {this.RenderPackets()}
        </fragment>;
    }

    //Private state
    private hostName: string;
    private settings: FirewallDebugSettings | null;
    private timerId: number | null;
    private packets: PacketCaptureInfo[];
    private loadingPackets: boolean;

    //Private methods
    private async ClearData()
    {
        await this.apiService.hosts._any_.firewallTracing.data.delete(this.hostName);
        this.packets = [];
    }

    private IsPacketCaptureEnabled()
    {
        const settings = this.settings!;
        const capturing = settings.hookBridgeForward || settings.hookForward || settings.hookInput || settings.hookOutput;

        return capturing;
    }

    private RenderButtons()
    {
        const majorButton = (this.timerId === null) ? <button type="button" onclick={this.UpdateSettings.bind(this)}>Start</button> : <button type="button" onclick={this.StopTimer.bind(this)}>Pause</button>;

        return <fragment>
            {majorButton}
            <button type="button" onclick={this.ClearData.bind(this)}>Clear</button>
        </fragment>;
    }

    private RenderPacket(packet: PacketCaptureInfo)
    {
        return <tr>
            <td>{packet.correlationId}</td>
            <td>{packet.family}</td>
            <td>{packet.table}</td>
            <td>{packet.chain}</td>
            <td>{packet.entryType}</td>
            <td>{packet.info}</td>
            <td>{packet.verdict}</td>
        </tr>;
    }

    private RenderPackets()
    {
        return <table className="table table-sm">
            <thead>
                <tr>
                    <th>Correlation Id</th>
                    <th>Family</th>
                    <th>Table</th>
                    <th>Chain</th>
                    <th>Entry type</th>
                    <th>Entry info</th>
                    <th>Verdict</th>
                </tr>
            </thead>
            <tbody>
                {this.packets.map(this.RenderPacket.bind(this))}
            </tbody>
            {this.loadingPackets ? <ProgressSpinner /> : null}
        </table>;
    }

    private RenderSettings(settings: FirewallDebugSettings)
    {
        const schema = this.apiSchemaService.GetSchema("FirewallDebugSettings");
        return <ObjectEditorComponent object={settings} schema={schema} />;
    }

    private StartPacketLoadingIfEnabled()
    {
        if(this.IsPacketCaptureEnabled())
        {
            this.StopTimer();
            this.timerId = setInterval(this.UpdatePacketLog.bind(this), 1000) as any;
        }
    }

    private StopTimer()
    {
        if(this.timerId !== null)
        {
            clearInterval(this.timerId);
            this.timerId = null;
        }
    }
    
    private async UpdatePacketLog()
    {
        this.loadingPackets = true;

        const response = await this.apiService.hosts._any_.firewallTracing.data.get(this.hostName);
        const data = ExtractDataFromResponseOrShowErrorMessageOnError(response);
        if(data.ok)
        {
            this.packets = data.value;
        }

        this.loadingPackets = false;
    }

    private async UpdateSettings()
    {
        await this.apiService.hosts._any_.firewallTracing.put(this.hostName, this.settings!);
        this.StartPacketLoadingIfEnabled();
    }

    //Event handlers
    override async OnInitiated(): Promise<void>
    {
        const response = await this.apiService.hosts._any_.firewallTracing.get(this.hostName);
        const data = ExtractDataFromResponseOrShowErrorMessageOnError(response);
        if(data.ok)
        {
            this.settings = data.value;
            this.StartPacketLoadingIfEnabled();
        }
    }
}