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
import { ResourceConfigController } from "../../data-access/ResourceConfigController";
import { ResourceDeletionError, ResourceStateResult } from "../ResourceProvider";
import { DockerContainerConfig, DockerContainerInfo, DockerEnvironmentVariableMapping, DockerManager } from "./DockerManager";
import { LightweightResourceReference } from "../../common/ResourceReference";
import { ResourcesManager } from "../../services/ResourcesManager";
import { VNetManager } from "../network-services/VNetManager";

export interface ContainerAppServiceConfig
{
    /**
     * @title Certificate
     * @format instance-same-host[web-services/letsencrypt-cert]
     */
    //certResourceExternalId?: string;

    env: DockerEnvironmentVariableMapping[];
    imageName: string;

    /**
     * @title Virtual network
     * @format instance-same-host[network-services/virtual-network]
     */
    vnetResourceExternalId: string;
}

@Injectable
export class ContainerAppServiceManager
{
    constructor(private dockerManager: DockerManager, private instanceConfigController: ResourceConfigController, private vnetManager: VNetManager, private resourcesManager: ResourcesManager)
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

    public async QueryContainerConfig(resourceId: number): Promise<ContainerAppServiceConfig>
    {
        const config = await this.instanceConfigController.QueryConfig<ContainerAppServiceConfig>(resourceId);
        if(config === undefined)
        {
            return {
                env: [],
                imageName: "",
                vnetResourceExternalId: ""
            };
        }

        return config;
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

    public async QueryResourceState(resourceReference: LightweightResourceReference): Promise<ResourceStateResult>
    {
        const state = await this.QueryContainerStatus(resourceReference);
        switch(state)
        {
            case "created":
            case "exited":
            case "not created yet":
                return "stopped";
            case "running":
                return "running";
        }
        throw new Error(state);
    }

    public async UpdateContainerConfig(resourceId: number, config: ContainerAppServiceConfig)
    {
        await this.instanceConfigController.UpdateOrInsertConfig(resourceId, config);
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

    private HasConfigChanged(containerData: DockerContainerInfo, config: ContainerAppServiceConfig)
    {
        const currentEnv = this.ParseEnv(containerData);
        if(!this.ArrayEqualsAnyOrder(currentEnv.ToArray(), config.env, "varName"))
            return true;

        return !(
            (containerData.Config.Image === config.imageName)
        );
    }

    private ParseEnv(containerData: DockerContainerInfo)
    {
        return containerData.Config.Env.Values()
            .Map(x => x.split("="))
            .Map(x => ({ varName: x[0], value: x[1] }))
            .Filter(x => x.varName !== "PATH");
    }

    private async StartContainer(resourceReference: LightweightResourceReference)
    {
        const config = await this.QueryContainerConfig(resourceReference.id);

        const containerName = this.DeriveContainerName(resourceReference);
        const containerData = await this.dockerManager.InspectContainer(resourceReference.hostId, containerName);
        if(containerData?.State.Running)
            throw new Error("Container is already running");

        const vnetRef = await this.resourcesManager.CreateResourceReferenceFromExternalId(config.vnetResourceExternalId);
        if(vnetRef === undefined)
            throw new Error("VNET does not exist!");
        const dockerNetName = await this.vnetManager.EnsureDockerNetworkExists(vnetRef);

        const dockerConfig: DockerContainerConfig = {
            additionalHosts: [],
            capabilities: [],
            dnsSearchDomains: [],
            dnsServers: [],
            env: config.env,
            imageName: config.imageName,
            networkName: dockerNetName,
            portMap: [],
            restartPolicy: "always",
            volumes: [],
        };

        /*const readOnlyVolumes = [];
        if(config.certResourceExternalId)
        {
            const rmgr = GlobalInjector.Resolve(ResourcesManager);
            const certResourceRef = await rmgr.CreateResourceReferenceFromExternalId(config.certResourceExternalId);
            const lem = GlobalInjector.Resolve(LetsEncryptManager);
            const cert = await lem.GetCert(certResourceRef!);

            readOnlyVolumes.push("-v", cert!.certificatePath + ":/certs/public.crt:ro");
            readOnlyVolumes.push("-v", cert!.privateKeyPath + ":/certs/private.key:ro");
        }*/

        if((containerData !== undefined) && this.HasConfigChanged(containerData, config))
        {
            await this.dockerManager.DeleteContainer(resourceReference.hostId, containerName);
            await this.dockerManager.CreateContainerInstance(resourceReference.hostId, containerName, dockerConfig);
        }
        else if(containerData === undefined)
            await this.dockerManager.CreateContainerInstance(resourceReference.hostId, containerName, dockerConfig);
        
        await this.dockerManager.StartExistingContainer(resourceReference.hostId, containerName);
    }
}