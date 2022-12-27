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

import { BootstrapIcon, Component, Injectable, JSX_CreateElement, MatIcon, ProgressSpinner, RouterState } from "acfrontend";
import { SMART_Attribute, SMART_Result } from "../../../dist/api";
import { APIService } from "../../Services/APIService";

enum AttrStatus
{
    Ok,
    Warning,
    Error,
    Unknown
}

@Injectable
export class ShowSMARTInfoComponent extends Component
{
    constructor(routerState: RouterState, private apiService: APIService)
    {
        super();

        //this.devPath = decodeURIComponent(routerState.routeParams.devPath!);
        this.hostName = routerState.routeParams.hostName!;
        this.devPath = routerState.routeParams.storageDevicePath!;
        this.smartInfo = null;
    }
    
    protected Render(): RenderValue
    {
        if(this.smartInfo === null)
            return <ProgressSpinner />;

        if(this.smartInfo.smartctl.exit_status != 0)
        {
            return <fragment>
                <h1>Error reading storage device health information</h1>
                <p>
                    The following errors were reported:
                </p>
                {this.smartInfo.smartctl.messages?.map(x => <p>{x.string}</p>)}
            </fragment>
        }
    
        return <fragment>
            <h1>Health status of: {this.devPath}</h1>
            {this.RenderErrors(this.smartInfo)}
            {this.RenderTests(this.smartInfo)}
            {this.RenderAttributes(this.smartInfo.ata_smart_attributes.table)}
        </fragment>;
    }

    //Private variables
    private hostName: string;
    private devPath: string;
    private smartInfo: SMART_Result | null;

    //Private methods
    private FindAttributeStatus(attr: SMART_Attribute): AttrStatus
    {
        switch(attr.id)
        {
            case 5: //Reallocated Sectors Count
            case 10: //Spin Retry Count
            case 187: //Reported Uncorrectable Errors
            case 196: //Reallocation Event Count
            case 197: //Current Pending Sector Count
            case 198: //(Offline) Uncorrectable Sector Count
                return (attr.raw.value == 0) ? AttrStatus.Ok : AttrStatus.Error;
            case 184: //End-to-End error / IOEDC
                alert("184 NOT IMPLEMENTED");
                break;
            case 188: //Command Timeout
                alert("188 NOT IMPLEMENTED");
                break;
            case 201: //Soft Read Error Rate / TA Counter Detected
                alert("201 NOT IMPLEMENTED");
                break;
        }
        return AttrStatus.Unknown;
    }

    private RenderAttributes(table: SMART_Attribute[])
    {
        return <fragment>
            <h2>Attributes</h2>
            <table className="table table-bordered">
                <thead>
                    <tr>
                        <th>Status</th>
                        <th>Id</th>
                        <th>Name</th>
                        <th>Value</th>
                        <th>Worst</th>
                        <th>Threshold</th>
                        <th>Raw</th>
                    </tr>
                </thead>
                <tbody className="table-group-divider">
                    {table.map(attr => <tr>
                        <td>{this.RenderStatus(attr)}</td>
                        <td>{attr.id}</td>
                        <td>{attr.name}</td>
                        <td>{attr.value}</td>
                        <td>{attr.worst}</td>
                        <td>{attr.thresh}</td>
                        <td>{attr.raw.value}</td>
                    </tr>)}
                </tbody>
            </table>
        </fragment>;
    }

    private RenderErrors(smartInfo: SMART_Result)
    {
        if(smartInfo.ata_smart_error_log.summary.count > 0)
            alert("TODO: DEVICE ERRORS IMPLEMENT ME");

        return <fragment>
            <h2>Errors</h2>
            None
        </fragment>;
    }

    private RenderStatus(attr: SMART_Attribute): RenderValue
    {
        switch(this.FindAttributeStatus(attr))
        {
            case AttrStatus.Ok:
                return <div className="text-success"><BootstrapIcon>check2</BootstrapIcon></div>;
            case AttrStatus.Error:
                return <MatIcon className="danger">error</MatIcon>;
            case AttrStatus.Warning:
                return <MatIcon className="warning">warning</MatIcon>;
            case AttrStatus.Unknown:
                return <div className="text-info"><BootstrapIcon>question</BootstrapIcon></div>;
        }
    }

    private RenderTests(smartInfo: SMART_Result)
    {
        if(smartInfo.ata_smart_self_test_log.standard.count > 0)
            alert("TODO: TEST RESULTS IMPLEMENT ME");

        return <fragment>
            <h2>Tests</h2>
            <table>
                <tr>
                    <th>Test</th>
                    <th>Estimated run time</th>
                </tr>
                {smartInfo.ata_smart_data.self_test.polling_minutes.Entries().Map(kv => <tr>
                    <td>{kv.key}</td>
                    <td>{kv.value} minutes</td>
                </tr>).ToArray()}
            </table>
        </fragment>;
    }

    //Event handlers
    public override async OnInitiated()
    {
        const response = await this.apiService.hosts._any_.storageDevices.smart.get(this.hostName, { devicePath: this.devPath });
        if(response.statusCode !== 200)
            throw new Error("NOT IMPLEMENTED");

        this.smartInfo = response.data;
    }
}