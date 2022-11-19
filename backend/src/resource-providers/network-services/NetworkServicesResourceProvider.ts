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
import { ModulesManager } from "../../services/ModulesManager";
import { DeploymentContext, DeploymentResult, ResourceDeletionError, ResourceProvider, ResourceTypeDefinition } from "../ResourceProvider";
import { OpenVPNGatewayProperties } from "./OpenVPNGatewayProperties";
import { EasyRSAManager } from "./EasyRSAManager";
import { OpenVPNGatewayConfig, OpenVPNGatewayManager } from "./OpenVPNGatewayManager";
import { SystemServicesManager } from "../../services/SystemServicesManager";
import { RemoteRootFileSystemManager } from "../../services/RemoteRootFileSystemManager";
import { SysCtlConfService } from "./SysCtlConfService";
 
@Injectable
export class NetworkServicesResourceProvider implements ResourceProvider<OpenVPNGatewayProperties>
{
    constructor(private instancesManager: InstancesManager, private modulesManager: ModulesManager, private remoteRootFileSystemManager: RemoteRootFileSystemManager,
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
    public async CheckInstanceAvailability(hostId: number, fullInstanceName: string): Promise<void>
    {
    }

    public async CheckInstanceHealth(hostId: number, fullInstanceName: string): Promise<void>
    {
    }
    
    public async DeleteResource(hostId: number, hostStoragePath: string, fullInstanceName: string): Promise<ResourceDeletionError | null>
    {
        await this.remoteRootFileSystemManager.RemoveFile(hostId, this.openVPNGatwayManager.BuildConfigPath(fullInstanceName));
        await this.systemServicesManager.Reload(hostId);
        await this.instancesManager.RemoveInstanceStorageDirectory(hostId, hostStoragePath, fullInstanceName);
        return null;
    }

    public async InstancePermissionsChanged(hostId: number, fullInstanceName: string): Promise<void>
    {
    }

    public async ProvideResource(instanceProperties: OpenVPNGatewayProperties, context: DeploymentContext): Promise<DeploymentResult>
    {
        await this.modulesManager.EnsureModuleIsInstalled(context.hostId, "openvpn");
        await this.sysCtlConfService.SetIPForwardingState(context.hostId, true);
        const instanceDir = this.instancesManager.BuildInstanceStoragePath(context.storagePath, context.fullInstanceName);

        await this.easyRSAManager.CreateCADir(context.hostId, instanceDir);
        await this.easyRSAManager.CreateCA(context.hostId, instanceDir, instanceProperties.name, instanceProperties.keySize);
        await this.easyRSAManager.CreateServer(context.hostId, instanceDir, instanceProperties.domainName, instanceProperties.keySize);

        const paths = this.easyRSAManager.GetCertPaths(instanceDir, instanceProperties.domainName);
        await this.openVPNGatwayManager.CreateServerConfig(context.hostId, instanceDir, context.fullInstanceName, this.openVPNGatwayManager.CreateDefaultConfig(), paths);

        const config: OpenVPNGatewayConfig = {
            dnsServerAddress: instanceProperties.dnsServerAddress,
            domainName: instanceProperties.domainName,
            keySize: instanceProperties.keySize
        };
        return {
            config
        };
    }
}