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
import { NextcloudManager } from "./NextcloudManager";
import { LetsEncryptManager } from "./LetsEncryptManager";
import { JdownloaderManager } from "./JdownloaderManager";
import { StaticWebsitesManager } from "./StaticWebsitesManager";
import { NodeAppServiceManager } from "./NodeAppServiceManager";
import { WebServicesResourceProperties } from "./Properties";
import { ResourceReference } from "../../common/ResourceReference";
import { API_GatewayManager } from "./API_GatewayManager";
import { DataSourcesProvider } from "../../services/ClusterDataProvider";
import { HealthStatus } from "../../data-access/HealthController";

@Injectable
export class WebServicesResourceProvider implements ResourceProvider<WebServicesResourceProperties>
{ 
    constructor(private nextcloudManager: NextcloudManager, private letsEncryptManager: LetsEncryptManager, private apiGatewayManager: API_GatewayManager,
        private jdownloaderManager: JdownloaderManager, private staticWebsitesManager: StaticWebsitesManager, private nodeAppServiceManager: NodeAppServiceManager)
    {
    }

    //Properties
    public get name(): string
    {
        return resourceProviders.webServices.name;
    }

    public get resourceTypeDefinitions(): ResourceTypeDefinition[]
    {
        return [
            {
                fileSystemType: "btrfs",
                dataIntegrityCheckSchedule: null,
                requiredModules: ["samba"],
                schemaName: "JdownloaderProperties"
            },
            {
                dataIntegrityCheckSchedule: {
                    type: "weekly",
                    counter: 3,
                },
                fileSystemType: "btrfs",
                requiredModules: [],
                schemaName: "LetsEncryptProperties"
            },
            {
                dataIntegrityCheckSchedule: null,
                fileSystemType: "btrfs",
                requiredModules: [],
                schemaName: "NextcloudProperties"
            },
            {
                dataIntegrityCheckSchedule: null,
                fileSystemType: "btrfs",
                requiredModules: ["node"],
                schemaName: "NodeAppServiceProperties"
            },
            {
                dataIntegrityCheckSchedule: null,
                fileSystemType: "btrfs",
                requiredModules: [],
                schemaName: "StaticWebsiteProperties"
            },
            {
                dataIntegrityCheckSchedule: null,
                fileSystemType: "btrfs",
                requiredModules: [],
                schemaName: "API_GatewayProperties"
            }
        ];
    }

    //Public methods
    public async CheckResource(resourceReference: ResourceReference, type: ResourceCheckType): Promise<HealthStatus | ResourceCheckResult>
    {
        switch(resourceReference.resourceTypeName)
        {
            case resourceProviders.webServices.apiGatewayResourceType.name:
                return await this.apiGatewayManager.QueryHealthStatus(resourceReference);
            case resourceProviders.webServices.jdownloaderResourceType.name:
                return await this.jdownloaderManager.QueryHealthStatus(resourceReference);
            case resourceProviders.webServices.letsencryptCertResourceType.name:
                if(type === ResourceCheckType.DataIntegrity)
                    await this.letsEncryptManager.RenewCertificateIfRequired(resourceReference);
                break;
            case resourceProviders.webServices.nodeAppServiceResourceType.name:
                return await this.nodeAppServiceManager.CheckResource(resourceReference, type);
            case resourceProviders.webServices.staticWebsiteResourceType.name:
                return await this.staticWebsitesManager.CheckResource(resourceReference, type);
        }

        return HealthStatus.Up;
    }
    
    public async DeleteResource(resourceReference: ResourceReference): Promise<ResourceDeletionError | null>
    {
        switch(resourceReference.resourceTypeName)
        {
            case resourceProviders.webServices.apiGatewayResourceType.name:
                await this.apiGatewayManager.DeleteResource(resourceReference);
                break;
            case resourceProviders.webServices.jdownloaderResourceType.name:
                await this.jdownloaderManager.DeleteResource(resourceReference);
                break;
            case resourceProviders.webServices.letsencryptCertResourceType.name:
                return await this.letsEncryptManager.DeleteResource(resourceReference);
            case resourceProviders.webServices.nextcloudResourceType.name:
                await this.nextcloudManager.DeleteResource(resourceReference);
                break;
            case resourceProviders.webServices.nodeAppServiceResourceType.name:
                await this.nodeAppServiceManager.DeleteResource(resourceReference);
                break;
            case resourceProviders.webServices.staticWebsiteResourceType.name:
                await this.staticWebsitesManager.DeleteResource(resourceReference);
                break;
        }
        return null;
    }

    public async ExternalResourceIdChanged(resourceReference: ResourceReference, oldExternalResourceId: string): Promise<void>
    {
    }

    public async ResourcePermissionsChanged(resourceReference: ResourceReference): Promise<void>
    {
        switch(resourceReference.resourceTypeName)
        {
            case resourceProviders.webServices.jdownloaderResourceType.name:
                await this.jdownloaderManager.RefreshPermissions(resourceReference);
                break;
        }
    }

    public async ProvideResource(instanceProperties: WebServicesResourceProperties, context: DeploymentContext): Promise<DeploymentResult>
    {
        switch(instanceProperties.type)
        {
            case "api-gateway":
                await this.apiGatewayManager.ProvideResource(instanceProperties, context);
                break;
            case "jdownloader":
                await this.jdownloaderManager.ProvideResource(instanceProperties, context);
                break;
            case "letsencrypt-cert":
                await this.letsEncryptManager.ProvideResource(instanceProperties, context);
                break;
            case "nextcloud":
                await this.nextcloudManager.ProvideResource(instanceProperties, context);
                break;
            case "node-app-service":
                await this.nodeAppServiceManager.ProvideResource(instanceProperties, context);
                break;
            case "static-website":
                await this.staticWebsitesManager.ProvideResource(instanceProperties, context);
                break;
        }

        return {};
    }

    public async QueryResourceState(resourceReference: ResourceReference): Promise<ResourceState>
    {
        switch(resourceReference.resourceTypeName)
        {
            case resourceProviders.webServices.jdownloaderResourceType.name:
                return await this.jdownloaderManager.QueryResourceState(resourceReference);
            case resourceProviders.webServices.letsencryptCertResourceType.name:
                return await this.letsEncryptManager.QueryResourceState(resourceReference);
            case resourceProviders.webServices.nodeAppServiceResourceType.name:
                return await this.nodeAppServiceManager.QueryResourceState(resourceReference);
        }
        return ResourceState.Running;
    }

    public async RehostResource(resourceReference: ResourceReference, targetProperties: WebServicesResourceProperties, context: DeploymentContext): Promise<void>
    {
        switch(targetProperties.type)
        {
            case "node-app-service":
                await this.nodeAppServiceManager.RehostResource(resourceReference, targetProperties, context);
                break;
            case "static-website":
                await this.staticWebsitesManager.RehostResource(resourceReference, targetProperties, context);
                break;
            default:
                throw new Error("Method not implemented.");
        }
    }

    public async RequestDataProvider(resourceReference: ResourceReference): Promise<DataSourcesProvider | null>
    {
        return null;
    }
}