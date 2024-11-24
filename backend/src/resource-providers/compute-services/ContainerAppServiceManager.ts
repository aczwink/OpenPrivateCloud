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
import { ResourceConfigController } from "../../data-access/ResourceConfigController";
import { DeploymentContext, ResourceDeletionError, ResourceState } from "../ResourceProvider";
import { DockerContainerConfig, DockerContainerConfigVolume, DockerContainerInfo, DockerEnvironmentVariableMapping, DockerManager } from "./DockerManager";
import { LightweightResourceReference } from "../../common/ResourceReference";
import { ResourcesManager } from "../../services/ResourcesManager";
import { VNetManager } from "../network-services/VNetManager";
import { DockerContainerProperties } from "./Properties";
import { ResourceDependenciesController } from "../../data-access/ResourceDependenciesController";
import { KeyVaultManager } from "../security-services/KeyVaultManager";
import { RemoteFileSystemManager } from "../../services/RemoteFileSystemManager";
import { FileStoragesManager } from "../file-services/FileStoragesManager";

interface Certificate
{
    keyVaultId: number;
    certificateName: string;
    certificateMountPoint: string;
    privateKeyMountPoint: string;
}

export interface ContainerAppServiceEnvironmentVariableMapping
{
    varName: string;
    value: string;
}

interface Secret
{
    keyVaultId: number;
    keyVaultSecretName: string;
    mountPointSecretName: string;
}

interface Volume
{
    fileStorageResourceId: number;
    fileStoragePath: string;
    containerPath: string;
    readOnly: boolean;
}

export interface ContainerAppServiceConfig
{
    cert?: Certificate;
    env: ContainerAppServiceEnvironmentVariableMapping[];
    imageName: string;
    secrets: Secret[];
    vnetResourceId: number;
    volumes?: Volume[];
}

@Injectable
export class ContainerAppServiceManager
{
    constructor(private dockerManager: DockerManager, private resourceConfigController: ResourceConfigController, private vnetManager: VNetManager, private resourcesManager: ResourcesManager,
        private resourceDependenciesController: ResourceDependenciesController, private keyVaultManager: KeyVaultManager, private remoteFileSystemManager: RemoteFileSystemManager,
        private fileStoragesManager: FileStoragesManager)
    {
    }

    //Public methods
    public async DeleteResource(resourceReference: LightweightResourceReference): Promise<ResourceDeletionError | null>
    {
        const containerName = this.DeriveContainerName(resourceReference);

        const containerInfo = await this.dockerManager.InspectContainer(resourceReference.hostId, containerName);
        if(containerInfo === undefined)
            return null;

        if(containerInfo.State.Running)
        {
            return {
                type: "ConflictingState",
                message: "The container is running. Shut it down before deleting it."
            };
        }
        await this.dockerManager.DeleteContainer(resourceReference.hostId, containerName);
        await this.resourcesManager.RemoveResourceStorageDirectory(resourceReference);

        return null;
    }

    public async ExecuteAction(resourceReference: LightweightResourceReference, action: "start" | "shutdown")
    {
        switch(action)
        {
            case "shutdown":
                await this.dockerManager.StopContainer(resourceReference.hostId, this.DeriveContainerName(resourceReference));
                break;
            case "start":
                await this.StartContainer(resourceReference);
                break;
        }
    }

    public async InspectContainer(resourceReference: LightweightResourceReference)
    {
        const containerName = this.DeriveContainerName(resourceReference);
        const containerData = await this.dockerManager.InspectContainer(resourceReference.hostId, containerName);

        return containerData;
    }

    public async ProvideResource(instanceProperties: DockerContainerProperties, context: DeploymentContext)
    {
        const vnetRef = await this.resourcesManager.CreateResourceReferenceFromExternalId(instanceProperties.vnetResourceId);
        await this.UpdateContainerConfig(context.resourceReference.id, {
            env: [],
            imageName: "hello-world",
            secrets: [],
            vnetResourceId: vnetRef!.id,
        });

        await this.resourcesManager.CreateResourceStorageDirectory(context.resourceReference);
    }

    public async QueryContainerConfig(resourceId: number): Promise<ContainerAppServiceConfig>
    {
        const config = await this.resourceConfigController.QueryConfig<ContainerAppServiceConfig>(resourceId);
        return config!;
    }

    public async QueryContainerStatus(resourceReference: LightweightResourceReference)
    {
        const containerData = await this.InspectContainer(resourceReference);
        if(containerData === undefined)
            return "not created yet";

        return containerData.State.Status;
    }

    public async QueryLog(resourceReference: LightweightResourceReference)
    {
        const status = await this.QueryContainerStatus(resourceReference);
        if(status === "not created yet")
        {
            return {
                stdOut: "",
                stdErr: ""
            };
        }

        const containerName = this.DeriveContainerName(resourceReference);
        return this.dockerManager.QueryContainerLogs(resourceReference.hostId, containerName);
    }

    public async QueryResourceState(resourceReference: LightweightResourceReference): Promise<ResourceState>
    {
        const state = await this.QueryContainerStatus(resourceReference);
        switch(state)
        {
            case "created":
            case "exited":
            case "not created yet":
                return ResourceState.Stopped;
            case "running":
                return ResourceState.Running;
        }
        throw new Error(state);
    }

    public async UpdateContainerConfig(resourceId: number, config: ContainerAppServiceConfig)
    {
        await this.resourceConfigController.UpdateOrInsertConfig(resourceId, config);

        const dependencies = [config.vnetResourceId, ...config.secrets.map(x => x.keyVaultId)];
        if(config.cert !== undefined)
            dependencies.push(config.cert.keyVaultId);
        if(config.volumes !== undefined)
            dependencies.push(...config.volumes?.map(x => x.fileStorageResourceId));
        await this.resourceDependenciesController.SetResourceDependencies(resourceId, dependencies);
    }

    public async UpdateContainerImage(resourceReference: LightweightResourceReference)
    {
        const containerName = this.DeriveContainerName(resourceReference);
        const containerData = await this.dockerManager.InspectContainer(resourceReference.hostId, containerName);
        if(containerData?.State.Running)
            throw new Error("Container is running");

        const config = await this.QueryContainerConfig(resourceReference.id);
        await this.dockerManager.PullImage(resourceReference.hostId, config.imageName);
    }

    //Private methods
    private ArrayEqualsAnyOrder<T>(a: T[], b: T[], key: keyof T)
    {
        const orderedA = a.Values().OrderBy(x => x[key] as any).ToArray();
        const orderedB = b.Values().OrderBy(x => x[key] as any).ToArray();
        return orderedA.Equals(orderedB);
    }

    private DeriveContainerName(resourceReference: LightweightResourceReference)
    {
        return "opc-rdc-" + resourceReference.id;
    }

    private async HasConfigChanged(containerData: DockerContainerInfo, config: ContainerAppServiceConfig)
    {
        const currentEnv = this.ParseEnv(containerData);
        const desiredEnv = await this.ResolveEnv(config.env);
        if(!this.ArrayEqualsAnyOrder(currentEnv.ToArray(), desiredEnv, "varName"))
            return true;

        if(config.cert !== undefined)
        {
            const kvRef = await this.resourcesManager.CreateResourceReference(config.cert.keyVaultId);
            const paths = await this.keyVaultManager.QueryCertificatePaths(kvRef!, config.cert.certificateName);

            const m1 = containerData.Mounts.find(x => (x.Source === paths.certPath) && (x.Destination === config.cert!.certificateMountPoint));
            const m2 = containerData.Mounts.find(x => (x.Source === paths.keyPath) && (x.Destination === config.cert!.privateKeyMountPoint));

            if( (m1 === undefined) || (m2 === undefined) )
                return true;
        }

        const expectedMountsCount = (config.volumes?.length ?? 0) + (config.cert === undefined ? 0 : 2) + (config.secrets.length > 0 ? 1 : 0) + 1; //the 1 at the end is the local volume that is created for every container but is not persisted
        return !(
            (containerData.Config.Image === config.imageName)
            &&
            (containerData.Mounts.length === expectedMountsCount)
        );
    }

    private ParseEnv(containerData: DockerContainerInfo)
    {
        return containerData.Config.Env.Values()
            .Map(x => x.split("="))
            .Map(x => ({ varName: x[0], value: x[1] }))
            .Filter(x => x.varName !== "PATH");
    }

    private async ResolveEnv(env: ContainerAppServiceEnvironmentVariableMapping[]): Promise<DockerEnvironmentVariableMapping[]>
    {
        return env;
    }

    private async StartContainer(resourceReference: LightweightResourceReference)
    {
        const config = await this.QueryContainerConfig(resourceReference.id);

        const containerName = this.DeriveContainerName(resourceReference);
        const containerData = await this.dockerManager.InspectContainer(resourceReference.hostId, containerName);
        if(containerData?.State.Running)
            throw new Error("Container is already running");

        const vnetRef = await this.resourcesManager.CreateResourceReference(config.vnetResourceId);
        const dockerNetwork = await this.vnetManager.EnsureDockerNetworkExists(vnetRef!);

        const volumes: DockerContainerConfigVolume[] = [];
        if(config.cert !== undefined)
        {
            const kvRef = await this.resourcesManager.CreateResourceReference(config.cert.keyVaultId);
            const paths = await this.keyVaultManager.QueryCertificatePaths(kvRef!, config.cert.certificateName);

            volumes.push(
                {
                    containerPath: config.cert.certificateMountPoint,
                    hostPath: paths.certPath,
                    readOnly: true,
                },
                {
                    containerPath: config.cert.privateKeyMountPoint,
                    hostPath: paths.keyPath,
                    readOnly: true,
                }
            );
        }
        if(config.secrets.length > 0)
        {
            const resourcesDir = this.resourcesManager.BuildResourceStoragePath(resourceReference);
            const secretsDir = path.join(resourcesDir, "secrets");
            await this.remoteFileSystemManager.CreateDirectory(resourceReference.hostId, secretsDir);

            //TODO: should use tmpfs instead just like docker swarm does
            for (const secret of config.secrets)
            {
                const secretDir = path.join(secretsDir, secret.mountPointSecretName);

                const kvRef = await this.resourcesManager.CreateResourceReference(secret.keyVaultId);
                const secretValue = await this.keyVaultManager.ReadSecret(kvRef!, secret.keyVaultSecretName);

                await this.remoteFileSystemManager.WriteTextFile(resourceReference.hostId, secretDir, secretValue);
            }

            volumes.push({
                containerPath: "/run/secrets",
                hostPath: secretsDir,
                readOnly: true
            });
        }
        if(config.volumes !== undefined)
        {
            for (const volume of config.volumes)
            {
                const fileStorageRef = await this.resourcesManager.CreateResourceReference(volume.fileStorageResourceId);

                volumes.push({
                    containerPath: volume.containerPath,
                    hostPath: this.fileStoragesManager.GetFullHostPathTo(fileStorageRef!, volume.fileStoragePath),
                    readOnly: volume.readOnly
                });
            }
        }

        const dockerConfig: DockerContainerConfig = {
            additionalHosts: [],
            capabilities: [],
            dnsSearchDomains: [],
            dnsServers: [dockerNetwork.primaryDNS_Server],
            env: await this.ResolveEnv(config.env),
            macAddress: this.dockerManager.CreateMAC_Address(resourceReference.id),
            imageName: config.imageName,
            networkName: dockerNetwork.name,
            portMap: [],
            privileged: false,
            removeOnExit: false,
            restartPolicy: "unless-stopped",
            volumes,
        };

        if((containerData !== undefined) && await this.HasConfigChanged(containerData, config))
        {
            await this.dockerManager.DeleteContainer(resourceReference.hostId, containerName);
            await this.dockerManager.CreateContainerInstance(resourceReference.hostId, containerName, dockerConfig);
        }
        else if(containerData === undefined)
            await this.dockerManager.CreateContainerInstance(resourceReference.hostId, containerName, dockerConfig);
        
        await this.dockerManager.StartExistingContainer(resourceReference.hostId, containerName);
    }
}