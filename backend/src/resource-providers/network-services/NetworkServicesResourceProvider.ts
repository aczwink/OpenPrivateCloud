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
import { ModulesManager } from "../../services/ModulesManager";
import { DeploymentContext, DeploymentResult, ResourceDeletionError, ResourceProvider, ResourceTypeDefinition } from "../ResourceProvider";
import { OpenVPNGatewayProperties } from "./OpenVPNGatewayProperties";
import { EasyRSAManager } from "./EasyRSAManager";
import { OpenVPNGatewayInternalConfig, OpenVPNGatewayManager } from "./OpenVPNGatewayManager";
import { SystemServicesManager } from "../../services/SystemServicesManager";
import { RemoteRootFileSystemManager } from "../../services/RemoteRootFileSystemManager";
import { SysCtlConfService } from "./SysCtlConfService";
import { InstanceContext } from "../../common/InstanceContext";
import { ResourceReference } from "../../common/InstanceReference";
 
@Injectable
export class NetworkServicesResourceProvider implements ResourceProvider<OpenVPNGatewayProperties>
{
    constructor(private instancesManager: ResourcesManager, private modulesManager: ModulesManager, private remoteRootFileSystemManager: RemoteRootFileSystemManager,
        private easyRSAManager: EasyRSAManager, private openVPNGatwayManager: OpenVPNGatewayManager, private systemServicesManager: SystemServicesManager,
        private sysCtlConfService: SysCtlConfService)
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
                healthCheckSchedule: null,
                fileSystemType: "btrfs",
                schemaName: "OpenVPNGatewayProperties"
            }
        ];
    }

    //Public methods
    public async CheckInstanceAvailability(instanceContext: InstanceContext): Promise<void>
    {
    }

    public async CheckInstanceHealth(instanceContext: InstanceContext): Promise<void>
    {
    }
    
    public async DeleteResource(resourceReference: ResourceReference): Promise<ResourceDeletionError | null>
    {
        await this.openVPNGatwayManager.StopServer(resourceReference.hostId, resourceReference.externalId);
        await this.remoteRootFileSystemManager.RemoveFile(resourceReference.hostId, this.openVPNGatwayManager.BuildConfigPath(resourceReference.externalId));
        await this.systemServicesManager.Reload(resourceReference.hostId);
        
        await this.instancesManager.RemoveInstanceStorageDirectory(resourceReference.hostId, resourceReference.hostStoragePath, resourceReference.externalId);
        return null;
    }

    public async InstancePermissionsChanged(resourceReference: ResourceReference): Promise<void>
    {
    }

    public async ProvideResource(instanceProperties: OpenVPNGatewayProperties, context: DeploymentContext): Promise<DeploymentResult>
    {
        await this.modulesManager.EnsureModuleIsInstalled(context.hostId, "openvpn");
        await this.sysCtlConfService.SetIPForwardingState(context.hostId, true);
        const instanceDir = this.instancesManager.BuildInstanceStoragePath(context.storagePath, context.resourceReference.externalId);

        await this.easyRSAManager.CreateCADir(context.hostId, instanceDir);
        await this.easyRSAManager.CreateCA(context.hostId, instanceDir, instanceProperties.name, instanceProperties.keySize);
        await this.easyRSAManager.CreateServer(context.hostId, instanceDir, instanceProperties.publicEndpoint.domainName, instanceProperties.keySize);

        const paths = this.easyRSAManager.GetCertPaths(instanceDir, instanceProperties.publicEndpoint.domainName);
        await this.openVPNGatwayManager.CreateServerConfig(context.hostId, instanceDir, context.resourceReference.externalId, this.openVPNGatwayManager.CreateDefaultConfig(), paths);
        await this.openVPNGatwayManager.AutoStartServer(context.hostId, context.resourceReference.externalId);

        const config: OpenVPNGatewayInternalConfig = {
            pki: {
                keySize: instanceProperties.keySize
            },
            publicEndpoint: instanceProperties.publicEndpoint,
        };
        return {
            config
        };
    }
}