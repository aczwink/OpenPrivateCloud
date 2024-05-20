/**
 * OpenPrivateCloud
 * Copyright (C) 2022-2024 Amir Czwink (amir130@hotmail.de)
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
import path from "path";
import { Injectable } from "acts-util-node";
import { resourceProviders } from "openprivatecloud-common";
import { ResourcesManager } from "../../services/ResourcesManager";
import { ModulesManager } from "../../services/ModulesManager";
import { DeploymentContext, DeploymentResult, ResourceCheckResult, ResourceCheckType, ResourceDeletionError, ResourceProvider, ResourceState, ResourceTypeDefinition } from "../ResourceProvider";
import { AVTranscoderProperties } from "./AVTranscoderProperties";
import { RemoteFileSystemManager } from "../../services/RemoteFileSystemManager";
import { AVTranscoderConfig, AVTranscoderQuality } from "./AVTranscoderConfig";
import { ResourceReference } from "../../common/ResourceReference";
import { DataSourcesProvider } from "../../services/ClusterDataProvider";
import { HealthStatus } from "../../data-access/HealthController";

@Injectable
export class MultimediaServicesResourceProvider implements ResourceProvider<AVTranscoderProperties>
{
    constructor(private modulesManager: ModulesManager, private resourcesManager: ResourcesManager, private remoteFileSystemManager: RemoteFileSystemManager)
    {
    }
    
    //Properties
    public get name(): string
    {
        return resourceProviders.multimediaServices.name;
    }

    public get resourceTypeDefinitions(): ResourceTypeDefinition[]
    {
        return [
            {
                dataIntegrityCheckSchedule: null,
                fileSystemType: "btrfs",
                requiredModules: [],
                schemaName: "AVTranscoderProperties"
            }
        ];
    }

    //Public methods
    public async CheckResource(resourceReference: ResourceReference, type: ResourceCheckType): Promise<HealthStatus | ResourceCheckResult>
    {
        return HealthStatus.Up;
    }
    
    public async DeleteResource(resourceReference: ResourceReference): Promise<ResourceDeletionError | null>
    {
        await this.resourcesManager.RemoveResourceStorageDirectory(resourceReference);
        return null;
    }

    public async ExternalResourceIdChanged(resourceReference: ResourceReference, oldExternalResourceId: string): Promise<void>
    {
    }

    public async ResourcePermissionsChanged(resourceReference: ResourceReference): Promise<void>
    {
    }

    public async ProvideResource(instanceProperties: AVTranscoderProperties, context: DeploymentContext): Promise<DeploymentResult>
    {
        await this.modulesManager.EnsureModuleIsInstalled(context.hostId, "ffmpeg");

        const instanceDir = await this.resourcesManager.CreateResourceStorageDirectory(context.resourceReference);

        const tmpDir = path.join(instanceDir, "tmp");
        await this.remoteFileSystemManager.CreateDirectory(context.hostId, tmpDir);

        const config: AVTranscoderConfig = {
            format: {
                audioCodec: "aac-lc",
                containerFormat: "mp4",
                quality: AVTranscoderQuality.Transparent,
                videoCodec: "h264-baseline",
            },
            source: {
                sourceFileStorageExternalId: instanceProperties.sourceFileStorageExternalId,
                sourcePath: "/"
            },
            targetPath: "/"
        };
        return {
            config
        };
    }

    public async QueryResourceState(resourceReference: ResourceReference): Promise<ResourceState>
    {
        return ResourceState.Running;
    }

    public async RequestDataProvider(resourceReference: ResourceReference): Promise<DataSourcesProvider | null>
    {
        return null;
    }
}