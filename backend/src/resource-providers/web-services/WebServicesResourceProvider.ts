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
import { ResourcesManager } from "../../services/ResourcesManager";
import { DeploymentContext, DeploymentResult, ResourceDeletionError, ResourceProvider, ResourceTypeDefinition } from "../ResourceProvider";
import { NextcloudManager } from "./NextcloudManager";
import { LetsEncryptManager } from "./LetsEncryptManager";
import { JdownloaderManager } from "./JdownloaderManager";
import { StaticWebsitesManager } from "./StaticWebsitesManager";
import { NodeAppServiceManager } from "./NodeAppServiceManager";
import { InstanceContext } from "../../common/InstanceContext";
import { WebServicesResourceProperties } from "./Properties";
import { ResourceReference } from "../../common/InstanceReference";

@Injectable
export class WebServicesResourceProvider implements ResourceProvider<WebServicesResourceProperties>
{ 
    constructor(private instancesManager: ResourcesManager, private nextcloudManager: NextcloudManager, private letsEncryptManager: LetsEncryptManager,
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
            }
        ];
    }

    //Public methods
    public async CheckInstanceAvailability(instanceContext: InstanceContext): Promise<void>
    {
    }

    public async CheckInstanceHealth(instanceContext: InstanceContext): Promise<void>
    {
        const parts = this.instancesManager.TODO_DEPRECATED_ExtractPartsFromFullInstanceName(instanceContext.fullInstanceName);
        switch(parts.resourceTypeName)
        {
            case resourceProviders.webServices.letsencryptCertResourceType.name:
                await this.letsEncryptManager.RenewCertificateIfRequired(instanceContext.hostId, instanceContext.fullInstanceName);
                break;
        }
    }
    
    public async DeleteResource(resourceReference: ResourceReference): Promise<ResourceDeletionError | null>
    {
        const hostId = resourceReference.hostId;
        const hostStoragePath = resourceReference.hostStoragePath;
        const fullInstanceName = resourceReference.externalId;

        switch(resourceReference.resourceTypeName)
        {
            case resourceProviders.webServices.jdownloaderResourceType.name:
                await this.jdownloaderManager.DeleteResource(hostId, hostStoragePath, fullInstanceName);
                break;
            case resourceProviders.webServices.letsencryptCertResourceType.name:
                throw new Error("not implemented");
            case resourceProviders.webServices.nextcloudResourceType.name:
                await this.nextcloudManager.DeleteResource(hostId, hostStoragePath, fullInstanceName);
                break;
            case resourceProviders.webServices.nodeAppServiceResourceType.name:
                await this.nodeAppServiceManager.DeleteResource(hostId, hostStoragePath, fullInstanceName);
                break;
            case resourceProviders.webServices.staticWebsiteResourceType.name:
                await this.staticWebsitesManager.DeleteResource(hostId, hostStoragePath, fullInstanceName);
                break;
        }
        return null;
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
}