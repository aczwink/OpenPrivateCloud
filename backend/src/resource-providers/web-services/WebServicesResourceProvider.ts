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
import { Injectable } from "acts-util-node";
import { resourceProviders } from "openprivatecloud-common";
import { InstancesManager } from "../../services/InstancesManager";
import { DeploymentContext, DeploymentResult, ResourceDeletionError, ResourceProvider, ResourceTypeDefinition } from "../ResourceProvider";
import { JdownloaderProperties, LetsEncryptProperties, NextcloudProperties, StaticWebsiteProperties } from "./Properties";
import { NextcloudManager } from "./NextcloudManager";
import { LetsEncryptManager } from "./LetsEncryptManager";
import { JdownloaderManager } from "./JdownloaderManager";
import { StaticWebsitesManager } from "./StaticWebsitesManager";

@Injectable
export class WebServicesResourceProvider implements ResourceProvider<JdownloaderProperties | LetsEncryptProperties | NextcloudProperties | StaticWebsiteProperties>
{ 
    constructor(private instancesManager: InstancesManager, private nextcloudManager: NextcloudManager, private letsEncryptManager: LetsEncryptManager,
        private jdownloaderManager: JdownloaderManager, private staticWebsitesManager: StaticWebsitesManager)
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
                schemaName: "StaticWebsiteProperties"
            }
        ];
    }

    //Public methods
    public async CheckInstanceAvailability(hostId: number, fullInstanceName: string): Promise<void>
    {
    }

    public async CheckInstanceHealth(hostId: number, fullInstanceName: string): Promise<void>
    {
        const parts = this.instancesManager.ExtractPartsFromFullInstanceName(fullInstanceName);
        switch(parts.resourceTypeName)
        {
            case resourceProviders.webServices.letsencryptCertResourceType.name:
                await this.letsEncryptManager.RenewCertificateIfRequired(hostId, fullInstanceName);
                break;
        }
    }
    
    public async DeleteResource(hostId: number, hostStoragePath: string, fullInstanceName: string): Promise<ResourceDeletionError | null>
    {
        const parts = this.instancesManager.ExtractPartsFromFullInstanceName(fullInstanceName);
        switch(parts.resourceTypeName)
        {
            case resourceProviders.webServices.jdownloaderResourceType.name:
                await this.jdownloaderManager.DeleteResource(hostId, hostStoragePath, fullInstanceName);
                break;
            case resourceProviders.webServices.letsencryptCertResourceType.name:
                throw new Error("not implemented");
            case resourceProviders.webServices.nextcloudResourceType.name:
                await this.nextcloudManager.DeleteResource(hostId, hostStoragePath, fullInstanceName);
                break;
            case resourceProviders.webServices.staticWebsiteResourceType.name:
                await this.staticWebsitesManager.DeleteResource(hostId, hostStoragePath, fullInstanceName);
                break;
        }
        return null;
    }

    public async InstancePermissionsChanged(hostId: number, fullInstanceName: string): Promise<void>
    {
    }

    public async ProvideResource(instanceProperties: JdownloaderProperties | LetsEncryptProperties | NextcloudProperties | StaticWebsiteProperties, context: DeploymentContext): Promise<DeploymentResult>
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
            case "static-website":
                await this.staticWebsitesManager.ProvideResource(instanceProperties, context);
                break;
        }

        return {};
    }
}