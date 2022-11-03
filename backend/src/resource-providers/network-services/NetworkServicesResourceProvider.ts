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
import path from "path";
import { Injectable } from "acts-util-node";
import { resourceProviders } from "openprivatecloud-common";
import { InstancesManager } from "../../services/InstancesManager";
import { ModulesManager } from "../../services/ModulesManager";
import { DeploymentContext, ResourceDeletionError, ResourceProvider, ResourceTypeDefinition } from "../ResourceProvider";
import { OpenVPNGatewayProperties } from "./OpenVPNGatewayProperties";
import { RemoteFileSystemManager } from "../../services/RemoteFileSystemManager";
import { EasyRSAManager } from "./EasyRSAManager";

 
@Injectable
export class NetworkServicesResourceProvider implements ResourceProvider<OpenVPNGatewayProperties>
{
    constructor(private instancesManager: InstancesManager, private modulesManager: ModulesManager, private remoteFileSystemManager: RemoteFileSystemManager,
        private easyRSAManager: EasyRSAManager)
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
                schemaName: "OpenVPNGatewayProperties"
            }
        ];
    }

    //Public methods
    public async DeleteResource(hostId: number, hostStoragePath: string, fullInstanceName: string): Promise<ResourceDeletionError | null>
    {
        await this.instancesManager.RemoveInstanceStorageDirectory(hostId, hostStoragePath, fullInstanceName);
        return null;
    }

    public InstancePermissionsChanged(hostId: number, fullInstanceName: string): Promise<void>
    {
        throw new Error("Method not implemented.");
    }

    public async ProvideResource(instanceProperties: OpenVPNGatewayProperties, context: DeploymentContext): Promise<void>
    {
        await this.modulesManager.EnsureModuleIsInstalled(context.hostId, "openvpn");
        const instancePath = await this.instancesManager.CreateInstanceStorageDirectory(context.hostId, context.storagePath, context.fullInstanceName);

        const pkiPath = path.join(instancePath, "pki");
        await this.easyRSAManager.CreateCADir(context.hostId, pkiPath);
        await this.easyRSAManager.CreateCA(context.hostId, pkiPath, instanceProperties.name, instanceProperties.keySize);
    }
}