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
import path from "path";
import { Injectable } from "acts-util-node";
import { ResourcesManager } from "../../services/ResourcesManager";
import { RemoteFileSystemManager } from "../../services/RemoteFileSystemManager";
import { DeploymentContext, ResourceCheckResult, ResourceCheckType } from "../ResourceProvider";
import { StaticWebsiteProperties } from "./Properties";
import { RemoteCommandExecutor } from "../../services/RemoteCommandExecutor";
import { TempFilesManager } from "../../services/TempFilesManager";
import { LightweightResourceReference } from "../../common/ResourceReference";
import { ManagedDockerContainerManager } from "../compute-services/ManagedDockerContainerManager";
import { ResourceDependenciesController } from "../../data-access/ResourceDependenciesController";
import { ResourceConfigController } from "../../data-access/ResourceConfigController";
import { HealthStatus } from "../../data-access/HealthController";

export interface StaticWebsiteConfig
{
    defaultRoute?: string;

    /**
     * Files that should be scanned for (left-to-right) in case of a request with a trailing slash in the URL.
     */
    indexFileNames: string;

    port: number;
}

@Injectable
export class StaticWebsitesManager
{
    constructor(private resourcesManager: ResourcesManager, private managedDockerContainerManager: ManagedDockerContainerManager, private resourceDependenciesController: ResourceDependenciesController,
        private remoteFileSystemManager: RemoteFileSystemManager, private resourceConfigController: ResourceConfigController, private tempFilesMangager: TempFilesManager, private remoteCommandExecutor: RemoteCommandExecutor)
    {
    }

    //Public methods
    public async CheckResource(resourceReference: LightweightResourceReference, type: ResourceCheckType): Promise<HealthStatus | ResourceCheckResult>
    {
        switch(type)
        {
            case ResourceCheckType.Availability:
            {
                const fp = await this.resourcesManager.IsResourceStoragePathOwnershipCorrect(resourceReference);
                if(!fp)
                {
                    return {
                        status: HealthStatus.Corrupt,
                        context: "incorrect file ownership"
                    };
                }

                return await this.managedDockerContainerManager.QueryHealthStatus(resourceReference);
            }
            case ResourceCheckType.ServiceHealth:
            {
                const fp = await this.resourcesManager.IsResourceStoragePathOwnershipCorrect(resourceReference);
                if(!fp)
                {
                    const rootPath = this.resourcesManager.BuildResourceStoragePath(resourceReference);
                    await this.resourcesManager.CorrectResourceStoragePathOwnership(resourceReference, [{ path: rootPath, recursive: true }]);
                }
            }
            break;
        }

        return HealthStatus.Up;
    }
    
    public async DeleteResource(resourceReference: LightweightResourceReference)
    {
        await this.managedDockerContainerManager.DestroyContainer(resourceReference);
        await this.resourcesManager.RemoveResourceStorageDirectory(resourceReference);
    }

    public ExtractContainerInfo(resourceReference: LightweightResourceReference)
    {
        return this.managedDockerContainerManager.ExtractContainerInfo(resourceReference);
    }

    public async ProvideResource(resourceProperties: StaticWebsiteProperties, context: DeploymentContext)
    {
        await this.WriteConfig(context.resourceReference.id, {
            indexFileNames: "index.html",
            port: resourceProperties.port,
        });

        await this.resourcesManager.CreateResourceStorageDirectory(context.resourceReference);
        const configPath = this.GetConfigPath(context.resourceReference);
        await this.remoteFileSystemManager.CreateDirectory(context.hostId, configPath);
        const contentPath = this.GetContentPath(context.resourceReference);
        await this.remoteFileSystemManager.CreateDirectory(context.hostId, contentPath);

        await this.Write_nginxConfig(context.resourceReference);

        await this.UpdateService(context.resourceReference, resourceProperties.vNetExternalId);
    }

    public async QueryConfig(resourceId: number)
    {
        const config = await this.resourceConfigController.QueryConfig<StaticWebsiteConfig>(resourceId);
        return config!;
    }

    public async RehostResource(resourceReference: LightweightResourceReference, targetProperties: StaticWebsiteProperties, context: DeploymentContext)
    {
        const srcPath = this.resourcesManager.BuildResourceStoragePath(resourceReference);
        const targetPath = this.resourcesManager.BuildResourceStoragePath(context.resourceReference);

        await this.remoteFileSystemManager.Replicate(resourceReference.hostId, srcPath, context.hostId, targetPath);

        await this.UpdateService(context.resourceReference, targetProperties.vNetExternalId);

        await this.DeleteResource(resourceReference);
    }

    public async UpdateConfig(resourceReference: LightweightResourceReference, config: StaticWebsiteConfig)
    {
        await this.WriteConfig(resourceReference.id, config);
        await this.Write_nginxConfig(resourceReference);
        await this.managedDockerContainerManager.RestartContainer(resourceReference);
    }

    public async UpdateContent(resourceReference: LightweightResourceReference, buffer: Buffer)
    {
        const hostId = resourceReference.hostId;

        const contentPath = this.GetContentPath(resourceReference);

        await this.CleanUpFolder(hostId, contentPath);

        const zipFilePath = await this.tempFilesMangager.CreateFile(hostId, buffer);
        await this.remoteCommandExecutor.ExecuteCommand(["unzip", zipFilePath, "-d", contentPath], hostId);
        await this.tempFilesMangager.Cleanup(hostId, zipFilePath);

        //await this.SetPermissionsRecursive(hostId, contentPath);
    }

    //Private methods
    private async CleanUpFolder(hostId: number, directoryPath: string)
    {
        const children = await this.remoteFileSystemManager.ListDirectoryContents(hostId, directoryPath);
        for (const child of children)
        {
            const childPath = path.join(directoryPath, child);
            const status = await this.remoteFileSystemManager.QueryStatus(hostId, childPath);
            if(status.isDirectory())
                await this.remoteFileSystemManager.RemoveDirectoryRecursive(hostId, childPath);
            else
                await this.remoteFileSystemManager.UnlinkFile(hostId, childPath);
        }
    }

    private Generate_nginxConfig(config: StaticWebsiteConfig)
    {
        const index = (config.defaultRoute === undefined) ? "" : ("try_files $uri $uri/ " + config.defaultRoute + ";");

        return `
server {
    listen ${config.port};
    server_name  localhost;

    location / {
        root   /usr/share/nginx/html;
        ${index}
        index ${config.indexFileNames};
    }
}
        `.trim();
    }
    
    private GetContentPath(resourceReference: LightweightResourceReference)
    {
        const resourceDir = this.resourcesManager.BuildResourceStoragePath(resourceReference);
        return path.join(resourceDir, "content");
    }

    private GetConfigPath(resourceReference: LightweightResourceReference)
    {
        const resourceDir = this.resourcesManager.BuildResourceStoragePath(resourceReference);
        return path.join(resourceDir, "config");
    }

    private async UpdateService(resourceReference: LightweightResourceReference, vNetExternalId: string)
    {
        const vNetResourceReference = await this.resourcesManager.CreateResourceReferenceFromExternalId(vNetExternalId);
        if(vNetResourceReference === undefined)
            throw new Error("VNet does not exist");
        await this.resourceDependenciesController.SetResourceDependencies(resourceReference.id, [vNetResourceReference.id]);

        const dockerNetwork = await this.managedDockerContainerManager.ResolveVNetToDockerNetwork(vNetResourceReference);

        await this.managedDockerContainerManager.EnsureContainerIsRunning(resourceReference, {
            additionalHosts: [],
            capabilities: [],
            dnsSearchDomains: [],
            dnsServers: [dockerNetwork.primaryDNS_Server],
            env: [],
            imageName: "nginx:latest",
            macAddress: this.managedDockerContainerManager.CreateMAC_Address(resourceReference.id),
            networkName: dockerNetwork.name,
            portMap: [],
            privileged: false,
            removeOnExit: false,
            restartPolicy: "always",
            volumes: [
                {
                    containerPath: "/etc/nginx/conf.d",
                    hostPath: this.GetConfigPath(resourceReference),
                    readOnly: true
                },
                {
                    containerPath: "/usr/share/nginx/html",
                    hostPath: this.GetContentPath(resourceReference),
                    readOnly: true
                }
            ],
        });
    }

    private async WriteConfig(resourceId: number, config: StaticWebsiteConfig)
    {
        await this.resourceConfigController.UpdateOrInsertConfig(resourceId, config);
    }

    private async Write_nginxConfig(resourceReference: LightweightResourceReference, )
    {
        const configPath = this.GetConfigPath(resourceReference);
        const config = await this.QueryConfig(resourceReference.id);
        await this.remoteFileSystemManager.WriteTextFile(resourceReference.hostId, path.join(configPath, "default.conf"), this.Generate_nginxConfig(config));
    }
}