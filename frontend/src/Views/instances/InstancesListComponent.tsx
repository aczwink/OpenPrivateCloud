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

import { Anchor, BootstrapIcon, Component, Injectable, JSX_CreateElement, MatIcon, ProgressSpinner, RouterButton } from "acfrontend";
import { resourceProviders } from "openprivatecloud-common/resourceProviders";
import { InstanceDto } from "../../../dist/api";
import { APIService } from "../../Services/APIService";
 
  
@Injectable
export class InstancesListComponent extends Component
{
    constructor(private apiService: APIService)
    {
        super();

        this.instances = null;
    }

    protected Render(): RenderValue
    {
        if(this.instances === null)
            return <ProgressSpinner />;

        return <fragment>
            <h2>Instances</h2>
            <table className="table table-striped">
                <thead>
                    <tr>
                        <th>Instance name</th>
                        <th>Instance type</th>
                        <th>Resource provider</th>
                    </tr>
                </thead>
                <tbody>
                    {this.instances.map(this.RenderInstance.bind(this))}
                </tbody>
            </table>
            <RouterButton className="btn btn-primary" route={"/instances/add"}><BootstrapIcon>plus</BootstrapIcon></RouterButton>
        </fragment>;
    }

    //Private variables
    private instances: InstanceDto[] | null;

    //Private methods
    private RenderInstance(instance: InstanceDto)
    {
        const parts = instance.fullName.substring(1).split("/");
        return <tr>
            <td>{this.RenderResourceIcon(parts[1])} <Anchor route={"/instances" + instance.fullName}>{parts[2]}</Anchor></td>
            <td>{parts[1]}</td>
            <td>{parts[0]}</td>
        </tr>;
    }

    private RenderResourceIcon(resourceType: string)
    {
        switch(resourceType)
        {
            case resourceProviders.backupServices.backupVaultResourceType.name:
                return <MatIcon>backup</MatIcon>;
            case resourceProviders.computeServices.virtualMachineResourceType.name:
                return <MatIcon>dvr</MatIcon>;
            case resourceProviders.databaseServices.mariadbResourceType.name:
                return <MatIcon>storage</MatIcon>;
            case resourceProviders.fileServices.fileStorageResourceType.name:
                return <BootstrapIcon>folder-fill</BootstrapIcon>;
            case resourceProviders.multimediaServices.avTranscoderResourceType.name:
                return <BootstrapIcon>film</BootstrapIcon>;
            case resourceProviders.networkServices.openVPNGatewayResourceType.name:
                return <MatIcon>vpn_lock</MatIcon>;
            case resourceProviders.webServices.jdownloaderResourceType.name:
                return <BootstrapIcon>cloud-download</BootstrapIcon>;
            case resourceProviders.webServices.letsencryptCertResourceType.name:
                return <MatIcon>verified</MatIcon>;
            case resourceProviders.webServices.nextcloudResourceType.name:
                return <BootstrapIcon>cloud</BootstrapIcon>;
        }
        return null;
    }

    //Event handlers
    override async OnInitiated(): Promise<void>
    {
        const response = await this.apiService.instances.get();
        this.instances = response.data;
    }
}