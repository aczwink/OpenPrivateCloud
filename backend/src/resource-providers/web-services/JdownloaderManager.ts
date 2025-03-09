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
import { Injectable } from "acts-util-node";
import path from "path";
import { ResourcesManager } from "../../services/ResourcesManager";
import { RemoteFileSystemManager } from "../../services/RemoteFileSystemManager";
import { SharedFolderPermissionsManager } from "../file-services/SharedFolderPermissionsManager";
import { SingleSMBSharePerInstanceProvider } from "../file-services/SingleSMBSharePerInstanceProvider";
import { DeploymentContext, ResourceState } from "../ResourceProvider";
import { JdownloaderProperties } from "./Properties";
import { LightweightResourceReference, ResourceReference } from "../../common/ResourceReference";
import { ManagedDockerContainerManager } from "../compute-services/ManagedDockerContainerManager";
import { ResourceConfigController } from "../../data-access/ResourceConfigController";
import { ResourceDependenciesController } from "../../data-access/ResourceDependenciesController";

interface MyJDownloaderConfig
{
    type: "myjd";

    email: string;
    /**
     * @format secret
     */
    password: string;
}

interface JDownloaderUIConfig
{
    type: "ui";
}

export type JDownloaderPublicConfig = MyJDownloaderConfig | JDownloaderUIConfig;

interface JDownloaderConfig
{
    public: JDownloaderPublicConfig;
    private: {
        vNetId: number
    };
}

@Injectable
export class JdownloaderManager
{
    constructor(private resourcesManager: ResourcesManager, private remoteFileSystemManager: RemoteFileSystemManager, private resourceConfigController: ResourceConfigController,
        private singleSMBSharePerInstanceProvider: SingleSMBSharePerInstanceProvider, private managedDockerContainerManager: ManagedDockerContainerManager,
        private sharedFolderPermissionsManager: SharedFolderPermissionsManager, private resourceDependenciesController: ResourceDependenciesController)
    {
    }

    //Public methods
    public async DeleteResource(resourceReference: LightweightResourceReference)
    {
        await this.managedDockerContainerManager.DestroyContainer(resourceReference);
        await this.resourcesManager.RemoveResourceStorageDirectory(resourceReference);
    }

    public async GetSMBConnectionInfo(resourceReference: ResourceReference, opcUserId: number)
    {
        return await this.singleSMBSharePerInstanceProvider.GetSMBConnectionInfo(resourceReference, opcUserId);
    }

    public async IsActive(resourceReference: LightweightResourceReference)
    {
        const info = await this.managedDockerContainerManager.ExtractContainerInfo(resourceReference);
        return info.ipAddresses.length > 0;
    }

    public async ProvideResource(instanceProperties: JdownloaderProperties, context: DeploymentContext)
    {
        const vnetRef = await this.resourcesManager.CreateResourceReferenceFromExternalId(instanceProperties.vnetResourceExternalId);
        await this.resourceDependenciesController.SetResourceDependencies(context.resourceReference.id, [vnetRef!.id]);

        await this.WriteConfig(context.resourceReference, {
            private: {
                vNetId: vnetRef!.id
            },
            public: {
                type: "ui"
            }
        });

        const resourceDir = await this.resourcesManager.CreateResourceStorageDirectory(context.resourceReference);
        await this.remoteFileSystemManager.ChangeMode(context.hostId, resourceDir, 0o775);

        const configDir = this.GetConfigPath(context.resourceReference);
        await this.remoteFileSystemManager.CreateDirectory(context.hostId, configDir);

        const downloadsPath = this.GetDownloadsPath(context.resourceReference);
        await this.remoteFileSystemManager.CreateDirectory(context.hostId, downloadsPath);
    }

    public QueryHealthStatus(resourceReference: LightweightResourceReference)
    {
        return this.managedDockerContainerManager.QueryHealthStatus(resourceReference);
    }

    public async QueryResourceState(resourceReference: LightweightResourceReference): Promise<ResourceState>
    {
        const isActive = await this.IsActive(resourceReference);
        if(isActive)
            return ResourceState.Running;
        return ResourceState.Stopped;
    }

    public async RefreshPermissions(resourceReference: ResourceReference)
    {
        const downloadsPath = this.GetDownloadsPath(resourceReference);

        await this.singleSMBSharePerInstanceProvider.UpdateSMBConfig({
            enabled: true,
            sharePath: downloadsPath,
            readOnly: true,
            transportEncryption: false
        }, resourceReference);

        await this.sharedFolderPermissionsManager.SetPermissions(resourceReference, downloadsPath, true);
    }

    public async RequestInfo(resourceReference: LightweightResourceReference)
    {
        const info = await this.managedDockerContainerManager.ExtractContainerInfo(resourceReference);
        return {
            ...info,
            uiPort: 5800
        };
    }

    public async RequestPublicConfig(resourceReference: LightweightResourceReference)
    {
        const config = await this.RequestConfig(resourceReference);
        return config.public;
    }

    public async StartOrStopService(resourceReference: LightweightResourceReference, action: "start" | "stop")
    {
        if(action === "start")
        {
            const config = await this.RequestConfig(resourceReference);

            const vNetRef = await this.resourcesManager.CreateResourceReference(config.private.vNetId);
            const dockerNetwork = await this.managedDockerContainerManager.ResolveVNetToDockerNetwork(vNetRef!);

            if(config.public.type === "ui")
            {
                await this.managedDockerContainerManager.EnsureContainerIsRunning(resourceReference, {
                    additionalHosts: [],
                    capabilities: [],
                    dnsSearchDomains: [],
                    dnsServers: [dockerNetwork.primaryDNS_Server],
                    env: [],
                    imageName: "jlesage/jdownloader-2",
                    macAddress: this.managedDockerContainerManager.CreateMAC_Address(resourceReference.id),
                    networkName: dockerNetwork.name,
                    portMap: [],
                    privileged: false,
                    removeOnExit: false,
                    restartPolicy: "unless-stopped",
                    volumes: [
                        {
                            containerPath: "/config",
                            hostPath: this.GetConfigPath(resourceReference),
                            readOnly: false
                        },
                        {
                            containerPath: "/output",
                            hostPath: this.GetDownloadsPath(resourceReference),
                            readOnly: false
                        }
                    ],
                });
            }
            else
            {
                await this.managedDockerContainerManager.EnsureContainerIsRunning(resourceReference, {
                    additionalHosts: [],
                    capabilities: [],
                    dnsSearchDomains: [],
                    //dnsServers: [dockerNetwork.primaryDNS_Server], //TODO fix this: for some reason it doesn't work within the vnet
                    dnsServers: [],
                    env: [
                        {
                            varName: "MYJD_USER",
                            value: config.public.email
                        },
                        {
                            varName: "MYJD_PASSWORD",
                            value: config.public.password
                        },
                        {
                            varName: "MYJD_DEVICE_NAME",
                            value: resourceReference.id.toString()
                        }
                    ],
                    imageName: "jaymoulin/jdownloader",
                    macAddress: this.managedDockerContainerManager.CreateMAC_Address(resourceReference.id),
                    //networkName: dockerNetwork.name, //TODO fix this: for some reason it doesn't work within the vnet
                    networkName: "host",
                    portMap: [],
                    privileged: false,
                    removeOnExit: false,
                    restartPolicy: "unless-stopped",
                    volumes: [
                        {
                            containerPath: "/opt/JDownloader/app/cfg",
                            hostPath: this.GetConfigPath(resourceReference),
                            readOnly: false
                        },
                        {
                            containerPath: "/opt/JDownloader/Downloads",
                            hostPath: this.GetDownloadsPath(resourceReference),
                            readOnly: false
                        }
                    ],
                });
            }
        }
        else
            await this.managedDockerContainerManager.DestroyContainer(resourceReference);
    }

    public async UpdatePublicConfig(resourceReference: LightweightResourceReference, config: JDownloaderPublicConfig)
    {
        await this.managedDockerContainerManager.DestroyContainer(resourceReference);

        const oldConfig = await this.RequestConfig(resourceReference);
        await this.WriteConfig(resourceReference, {
            private: oldConfig.private,
            public: config
        });
    }

    //Private methods
    private GetConfigPath(resourceReference: LightweightResourceReference)
    {
        const resourceDir = this.resourcesManager.BuildResourceStoragePath(resourceReference);
        return path.join(resourceDir, "config");
    }

    private GetDownloadsPath(resourceReference: LightweightResourceReference)
    {
        const resourceDir = this.resourcesManager.BuildResourceStoragePath(resourceReference);
        return path.join(resourceDir, "downloads");
    }

    private async RequestConfig(resourceReference: LightweightResourceReference): Promise<JDownloaderConfig>
    {
        const config = await this.resourceConfigController.QueryConfig<JDownloaderConfig>(resourceReference.id);
        return config!;
    }

    private async WriteConfig(resourceReference: LightweightResourceReference, config: JDownloaderConfig)
    {
        await this.resourceConfigController.UpdateOrInsertConfig(resourceReference.id, config);
    }
}