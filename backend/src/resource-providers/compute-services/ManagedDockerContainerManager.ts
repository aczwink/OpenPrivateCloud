/**
 * OpenPrivateCloud
 * Copyright (C) 2023 Amir Czwink (amir130@hotmail.de)
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
import { LightweightResourceReference } from "../../common/ResourceReference";
import { DockerContainerConfig, DockerManager } from "./DockerManager";
import { ResourceStateResult } from "../ResourceProvider";
import { ResourcesManager } from "../../services/ResourcesManager";
import { VNetManager } from "../network-services/VNetManager";

export interface ContainerInfo
{
    ipAddresses: string[];
}

@Injectable
export class ManagedDockerContainerManager
{
    constructor(private dockerManager: DockerManager, private resourcesManager: ResourcesManager, private vnetManager: VNetManager)
    {
    }
    
    //Public methods
    public async DestroyContainer(resourceReference: LightweightResourceReference)
    {
        const containerName = this.DeriveContainerName(resourceReference);
        const containerInfo = await this.dockerManager.InspectContainer(resourceReference.hostId, containerName);
        if(containerInfo === undefined)
            return;

        if(containerInfo.State.Running)
            await this.dockerManager.StopContainer(resourceReference.hostId, containerName);

        await this.dockerManager.DeleteContainer(resourceReference.hostId, containerName);
    }
    
    public async EnsureContainerIsRunning(resourceReference: LightweightResourceReference, config: DockerContainerConfig)
    {
        await this.DestroyContainer(resourceReference);

        const containerName = this.DeriveContainerName(resourceReference);
        await this.dockerManager.CreateContainerInstanceAndStart(resourceReference.hostId, containerName, config);
    }

    public async ExtractContainerInfo(resourceReference: LightweightResourceReference): Promise<ContainerInfo>
    {
        const containerName = this.DeriveContainerName(resourceReference);
        const containerInfo = await this.dockerManager.InspectContainer(resourceReference.hostId, containerName);
        if(containerInfo === undefined)
        {
            return {
                ipAddresses: []
            };
        }

        return {
            ipAddresses: containerInfo.NetworkSettings.Networks.Values().NotUndefined().Map(x => x.IPAddress).ToArray()
        };
    }

    public async QueryResourceState(resourceReference: LightweightResourceReference): Promise<ResourceStateResult>
    {
        const containerName = this.DeriveContainerName(resourceReference);
        const containerInfo = await this.dockerManager.InspectContainer(resourceReference.hostId, containerName);
        if(containerInfo === undefined)
            return "in deployment";

        switch(containerInfo.State.Status)
        {
            case "created":
            case "restarting":
                return "in deployment";
            case "exited":
                return "down";
            case "running":
                return "running";
        }
    }

    public async ResolveVNetToDockerNetworkName(vnetResourceExternalId: string): Promise<string>
    {
        const vnetRef = await this.resourcesManager.CreateResourceReferenceFromExternalId(vnetResourceExternalId);
        if(vnetRef === undefined)
            throw new Error("VNET does not exist!");
        const dockerNetName = await this.vnetManager.EnsureDockerNetworkExists(vnetRef);
        return dockerNetName;
    }

    //Private methods
    private DeriveContainerName(resourceReference: LightweightResourceReference)
    {
        return "opc-rmdc-" + resourceReference.id;
    }
}