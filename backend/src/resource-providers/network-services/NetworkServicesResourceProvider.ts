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
import { Injectable } from "acts-util-node";
import { resourceProviders } from "openprivatecloud-common";
import { DeploymentContext, DeploymentResult, ResourceCheckResult, ResourceCheckType, ResourceDeletionError, ResourceProvider, ResourceState, ResourceTypeDefinition } from "../ResourceProvider";
import { OpenVPNGatewayManager } from "./OpenVPNGatewayManager";
import { ResourceReference } from "../../common/ResourceReference";
import { NetworkServicesProperties } from "./properties";
import { DNS_ServerManager } from "./DNS_ServerManager";
import { VNetManager } from "./VNetManager";
import { DataSourcesProvider } from "../../services/ClusterDataProvider";
import { HealthStatus } from "../../data-access/HealthController";
 
@Injectable
export class NetworkServicesResourceProvider implements ResourceProvider<NetworkServicesProperties>
{
    constructor(private openVPNGatwayManager: OpenVPNGatewayManager, private dnsServerManager: DNS_ServerManager, private vnetManager: VNetManager)
    {
    }

    //Properties
    public get name(): string
    {
        return resourceProviders.networkServices.name;
    }

    public get resourceTypeDefinitions(): ResourceTypeDefinition[]
    {
        return [
            {
                fileSystemType: "btrfs",
                dataIntegrityCheckSchedule: null,
                requiredModules: [],
                schemaName: "DNS_ServerProperties"
            },
            {
                dataIntegrityCheckSchedule: null,
                fileSystemType: "btrfs",
                requiredModules: ["openvpn"],
                schemaName: "OpenVPNGatewayProperties"
            },
            {
                fileSystemType: "btrfs",
                dataIntegrityCheckSchedule: null,
                requiredModules: [],
                schemaName: "VirtualNetworkProperties"
            }
        ];
    }

    //Public methods
    public async CheckResource(resourceReference: ResourceReference, type: ResourceCheckType): Promise<HealthStatus | ResourceCheckResult>
    {
        switch(resourceReference.resourceTypeName)
        {
            case resourceProviders.networkServices.dnsServerResourceType.name:
                return await this.dnsServerManager.QueryHealthStatus(resourceReference);
            case resourceProviders.networkServices.openVPNGatewayResourceType.name:
                return await this.openVPNGatwayManager.CheckResource(resourceReference, type);
            case resourceProviders.networkServices.virtualNetworkResourceType.name:
                return await this.vnetManager.CheckResource(resourceReference, type);
        }

        return HealthStatus.Up;
    }
    
    public async DeleteResource(resourceReference: ResourceReference): Promise<ResourceDeletionError | null>
    {
        switch(resourceReference.resourceTypeName)
        {
            case resourceProviders.networkServices.dnsServerResourceType.name:
                await this.dnsServerManager.DeleteResource(resourceReference);
                break;
            case resourceProviders.networkServices.openVPNGatewayResourceType.name:
                await this.openVPNGatwayManager.DeleteResource(resourceReference);
                break;
            case resourceProviders.networkServices.virtualNetworkResourceType.name:
                await this.vnetManager.DeleteResource(resourceReference);
                break;
        }

        return null;
    }

    public async ExternalResourceIdChanged(resourceReference: ResourceReference, oldExternalResourceId: string): Promise<void>
    {
    }

    public async ResourcePermissionsChanged(resourceReference: ResourceReference): Promise<void>
    {
    }

    public async ProvideResource(instanceProperties: NetworkServicesProperties, context: DeploymentContext): Promise<DeploymentResult>
    {
        switch(instanceProperties.type)
        {
            case "dns-server":
                await this.dnsServerManager.ProvideResource(instanceProperties, context);
                return {};
            case "openvpn-gateway":
                await this.openVPNGatwayManager.ProvideResource(instanceProperties, context);
                return {};
            case "virtual-network":
                await this.vnetManager.ProvideResource(instanceProperties, context);
                return {};
        }
    }

    public async QueryResourceState(resourceReference: ResourceReference): Promise<ResourceState>
    {
        switch(resourceReference.resourceTypeName)
        {
            case resourceProviders.networkServices.openVPNGatewayResourceType.name:
                return await this.openVPNGatwayManager.QueryResourceState(resourceReference);
            case resourceProviders.networkServices.virtualNetworkResourceType.name:
                return await this.vnetManager.QueryResourceState(resourceReference);
        }
        return ResourceState.Running;
    }

    public async RequestDataProvider(resourceReference: ResourceReference): Promise<DataSourcesProvider | null>
    {
        switch(resourceReference.resourceTypeName)
        {
            case resourceProviders.networkServices.openVPNGatewayResourceType.name:
                return await this.openVPNGatwayManager.GetLogDataProvider(resourceReference);
        }
        return null;
    }
}