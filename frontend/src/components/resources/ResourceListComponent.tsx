/**
 * OpenPrivateCloud
 * Copyright (C) 2019-2025 Amir Czwink (amir130@hotmail.de)
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

import { Anchor, APIResponse, BootstrapIcon, Component, Injectable, JSX_CreateElement, ProgressSpinner, Router, RouterButton, RouterState } from "acfrontend";
import { resourceProviders } from "openprivatecloud-common/resourceProviders";
import { HealthStatus, ResourceOverviewDataDTO, ResourceState } from "../../../dist/api";
import { APIService } from "../../services/APIService";
 
  
@Injectable
export class ResourceListComponent extends Component<{ query: (apiService: APIService) => Promise<APIResponse<ResourceOverviewDataDTO[]>>}>
{
    constructor(private apiService: APIService, routerState: RouterState, private router: Router)
    {
        super();

        this.resources = null;
        this.resourceGroupName = routerState.routeParams.resourceGroupName || null;
    }

    protected Render(): RenderValue
    {
        if( (this.resources === null) )
            return <ProgressSpinner />;

        return <fragment>
            <h2>Resources</h2>
            <table className="table table-striped">
                <thead>
                    <tr>
                        <th onclick={this.Sort.bind(this, "name")}>Resource name</th>
                        <th>Resource type</th>
                        <th>State</th>
                        <th>Resource provider</th>
                    </tr>
                </thead>
                <tbody>
                    {this.resources.map(this.RenderInstance.bind(this))}
                </tbody>
            </table>
            {this.resourceGroupName === null ? null : <RouterButton color="primary" route={"/resourcegroups/" + this.resourceGroupName + "/resources/add"}><BootstrapIcon>plus</BootstrapIcon></RouterButton>}
        </fragment>;
    }

    //State
    private resourceGroupName: string | null;
    private resources: ResourceOverviewDataDTO[] | null;

    //Private methods
    private RenderInstance(resource: ResourceOverviewDataDTO)
    {
        const urlPart = resource.id.substring(resource.id.indexOf("/", 1));
        return <tr>
            <td>{this.RenderResourceIcon(resource.instanceType)} <Anchor route={"/resourcegroups/" + resource.resourceGroupName + "/resources" + urlPart}>{resource.name}</Anchor></td>
            <td>{resource.instanceType}</td>
            <td>{this.RenderState(resource.healthStatus, resource.state)}</td>
            <td>{resource.resourceProviderName}</td>
        </tr>;
    }

    private RenderResourceIcon(resourceType: string)
    {
        switch(resourceType)
        {
            case resourceProviders.backupServices.backupVaultResourceType.name:
                return <BootstrapIcon>safe</BootstrapIcon>;
            case resourceProviders.computeServices.dockerContainerResourceType.name:
                return <BootstrapIcon>box-seam-fill</BootstrapIcon>;
            case resourceProviders.computeServices.virtualMachineResourceType.name:
                return <BootstrapIcon>pc-display</BootstrapIcon>;
            case resourceProviders.databaseServices.mariadbResourceType.name:
                return <BootstrapIcon>database</BootstrapIcon>;
            case resourceProviders.fileServices.fileStorageResourceType.name:
                return <BootstrapIcon>folder-fill</BootstrapIcon>;
            case resourceProviders.multimediaServices.avTranscoderResourceType.name:
                return <BootstrapIcon>film</BootstrapIcon>;
            case resourceProviders.networkServices.dnsServerResourceType.name:
                return <BootstrapIcon>signpost-split</BootstrapIcon>;
            case resourceProviders.networkServices.openVPNGatewayResourceType.name:
                return <BootstrapIcon>shield-lock</BootstrapIcon>;
            case resourceProviders.networkServices.virtualNetworkResourceType.name:
                return <BootstrapIcon>ethernet</BootstrapIcon>;
            case resourceProviders.securityServices.keyVaultResourceTypeName.name:
                return <BootstrapIcon>key</BootstrapIcon>;
            case resourceProviders.securityServices.wafResourceTypeName.name:
                return <BootstrapIcon>fire</BootstrapIcon>;
            case resourceProviders.webServices.appGatewayResourceType.name:
                return <BootstrapIcon>sign-turn-right</BootstrapIcon>;
            case resourceProviders.webServices.jdownloaderResourceType.name:
                return <BootstrapIcon>cloud-download</BootstrapIcon>;
            case resourceProviders.webServices.letsencryptCertResourceType.name:
                return <BootstrapIcon>patch-check-fill</BootstrapIcon>;
            case resourceProviders.webServices.nextcloudResourceType.name:
                return <BootstrapIcon>cloud</BootstrapIcon>;
            case resourceProviders.webServices.nodeAppServiceResourceType.name:
                return <BootstrapIcon>app</BootstrapIcon>;
            case resourceProviders.webServices.staticWebsiteResourceType.name:
                return <BootstrapIcon>file-richtext</BootstrapIcon>;
        }
        return null;
    }

    private RenderState(healthStatus: HealthStatus, state: ResourceState)
    {
        switch(healthStatus)
        {
            case HealthStatus.Corrupt:
                return <div className="text-danger"><BootstrapIcon>x-circle-fill</BootstrapIcon></div>;
            case HealthStatus.Down:
                return <div className="text-warning"><BootstrapIcon>exclamation-circle-fill</BootstrapIcon></div>;
            case HealthStatus.InDeployment:
                return <div className="text-danger"><BootstrapIcon>hourglass-split</BootstrapIcon></div>;
        }
        
        switch(state)
        {
            case ResourceState.Running:
                return <div className="text-success"><BootstrapIcon>check-circle-fill</BootstrapIcon></div>;
            case ResourceState.Stopped:
                return <div className="text-danger"><BootstrapIcon>stop-fill</BootstrapIcon></div>;
            case ResourceState.Waiting:
                return <div className="text-primary"><BootstrapIcon>clock-history</BootstrapIcon></div>;
        }
    }

    private Sort(key: keyof ResourceOverviewDataDTO)
    {
        this.resources?.SortBy(x => x[key]);
        this.Update();
    }

    //Event handlers
    override async OnInitiated(): Promise<void>
    {
        const response = await this.input.query(this.apiService);

        if(response.data === undefined)
            throw new Error("TODO: implement me");
        const data = response.data;

        data.SortBy(x => x.name);
        this.resources = data;
    }
}