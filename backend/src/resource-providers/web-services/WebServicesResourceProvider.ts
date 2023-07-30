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
import { Injectable } from "acts-util-node";
import { resourceProviders } from "openprivatecloud-common";
import { DeploymentContext, DeploymentResult, ResourceDeletionError, ResourceProvider, ResourceStateResult, ResourceTypeDefinition } from "../ResourceProvider";
import { NextcloudManager } from "./NextcloudManager";
import { LetsEncryptManager } from "./LetsEncryptManager";
import { JdownloaderManager } from "./JdownloaderManager";
import { StaticWebsitesManager } from "./StaticWebsitesManager";
import { NodeAppServiceManager } from "./NodeAppServiceManager";
import { WebServicesResourceProperties } from "./Properties";
import { ResourceReference } from "../../common/ResourceReference";
import { API_GatewayManager } from "./API_GatewayManager";

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
                healthCheckSchedule: null,
                schemaName: "JdownloaderProperties"
            },
            {
                healthCheckSchedule: {
                    type: "weekly",
                    counter: 3,
                },
                fileSystemType: "btrfs",
                schemaName: "LetsEncryptProperties"
            },
            {
                healthCheckSchedule: null,
                fileSystemType: "btrfs",
                schemaName: "NextcloudProperties"
            },
            {
                healthCheckSchedule: null,
                fileSystemType: "btrfs",
                schemaName: "NodeAppServiceProperties"
            },
            {
                healthCheckSchedule: null,
                fileSystemType: "btrfs",
                schemaName: "StaticWebsiteProperties"
            },
            {
                healthCheckSchedule: null,
                fileSystemType: "btrfs",
                schemaName: "API_GatewayProperties"
            }
        ];
    }

    //Public methods
    public async CheckResourceHealth(resourceReference: ResourceReference): Promise<void>
    {
        switch(resourceReference.resourceTypeName)
        {
            case resourceProviders.webServices.letsencryptCertResourceType.name:
                await this.letsEncryptManager.RenewCertificateIfRequired(resourceReference);
                break;
        }
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
                await this.letsEncryptManager.DeleteResource(resourceReference);
                break;
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

    public async InstancePermissionsChanged(resourceReference: ResourceReference): Promise<void>
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

    public async QueryResourceState(resourceReference: ResourceReference): Promise<ResourceStateResult>
    {
        switch(resourceReference.resourceTypeName)
        {
            case resourceProviders.webServices.apiGatewayResourceType.name:
                return await this.apiGatewayManager.QueryResourceState(resourceReference);
            case resourceProviders.webServices.jdownloaderResourceType.name:
                return await this.jdownloaderManager.QueryResourceState(resourceReference);
            case resourceProviders.webServices.letsencryptCertResourceType.name:
                return await this.letsEncryptManager.QueryResourceState(resourceReference);
            case resourceProviders.webServices.nextcloudResourceType.name:
                return "running";
            case resourceProviders.webServices.nodeAppServiceResourceType.name:
                return await this.nodeAppServiceManager.QueryResourceState(resourceReference);
            case resourceProviders.webServices.staticWebsiteResourceType.name:
                return "running";
        }
        return "corrupt";
    }
}