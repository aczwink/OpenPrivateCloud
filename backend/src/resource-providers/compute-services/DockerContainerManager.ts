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
import { ResourceDeletionError, ResourceState } from "../ResourceProvider";
import { DockerContainerConfig, DockerContainerConfigPortMapping, DockerContainerInfo, DockerManager } from "./DockerManager";
import { LightweightResourceReference } from "../../common/ResourceReference";

@Injectable
export class DockerContainerManager
{
    constructor(private dockerManager: DockerManager, private instanceConfigController: ResourceConfigController)
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

    public async QueryContainerConfig(resourceId: number): Promise<DockerContainerConfig>
    {
        const config = await this.instanceConfigController.QueryConfig<DockerContainerConfig>(resourceId);
        if(config === undefined)
        {
            return {
                env: [],
                imageName: "",
                portMap: [],
                restartPolicy: "no",
                volumes: []
            };
        }

        return config;
    }

    public async QueryContainerStatus(resourceReference: LightweightResourceReference)
    {
        const containerName = this.DeriveContainerName(resourceReference);
        const containerData = await this.dockerManager.InspectContainer(resourceReference.hostId, containerName);
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
            case "exited":
            case "not created yet":
                return "stopped";
            case "running":
                return "running";
        }
        throw new Error(state);
    }

    public async UpdateContainerConfig(resourceId: number, config: DockerContainerConfig)
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

    private HasConfigChanged(containerData: DockerContainerInfo, config: DockerContainerConfig)
    {
        const currentPortMapping = this.ParsePortBindings(containerData);
        if(!this.ArrayEqualsAnyOrder(currentPortMapping, config.portMap, "hostPost"))
            return true;

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

    private ParsePortBindings(containerData: DockerContainerInfo): DockerContainerConfigPortMapping[]
    {
        const result: DockerContainerConfigPortMapping[] = [];
        for (const containerBinding in containerData.HostConfig.PortBindings)
        {
            if (Object.prototype.hasOwnProperty.call(containerData.HostConfig.PortBindings, containerBinding))
            {
                const hostBinding = containerData.HostConfig.PortBindings[containerBinding]!;

                const parts = containerBinding.split("/");
                const containerPort = parseInt(parts[0]);

                hostBinding.forEach(x => result.push({
                    containerPort,
                    hostPost: parseInt(x.HostPort),
                    protocol: parts[1].toUpperCase() as any
                }));
            }
        }
        return result;
    }

    private async StartContainer(resourceReference: LightweightResourceReference)
    {
        const config = await this.QueryContainerConfig(resourceReference.id);

        const containerName = this.DeriveContainerName(resourceReference);
        const containerData = await this.dockerManager.InspectContainer(resourceReference.hostId, containerName);
        if(containerData?.State.Running)
            throw new Error("Container is already running");

        if((containerData !== undefined) && this.HasConfigChanged(containerData, config))
        {
            await this.dockerManager.DeleteContainer(resourceReference.hostId, containerName);
            await this.dockerManager.CreateContainerInstance(resourceReference.hostId, containerName, config);
        }
        else if(containerData === undefined)
            await this.dockerManager.CreateContainerInstance(resourceReference.hostId, containerName, config);
        
        await this.dockerManager.StartExistingContainer(resourceReference.hostId, containerName);
    }
}