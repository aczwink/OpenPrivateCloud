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
import { InstanceConfigController } from "../../data-access/InstanceConfigController";
import { ResourceDeletionError } from "../ResourceProvider";
import { DockerContainerConfig, DockerContainerConfigPortMapping, DockerContainerInfo, DockerManager } from "./DockerManager";
import { LightweightResourceReference } from "../../common/InstanceReference";

@Injectable
export class DockerContainerManager
{
    constructor(private dockerManager: DockerManager, private instanceConfigController: InstanceConfigController)
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
    private DeriveContainerName(resourceReference: LightweightResourceReference)
    {
        return "opc-rdc-" + resourceReference.id;
    }

    private HasConfigChanged(containerData: DockerContainerInfo, config: DockerContainerConfig)
    {
        const currentPortMapping = this.ParsePortBindings(containerData);
        const desiredPortMapping = config.portMap;

        currentPortMapping.SortBy(x => x.hostPost);
        if(!currentPortMapping.Equals(desiredPortMapping.Values().OrderBy(x => x.hostPost).ToArray()))
            return true;

        return !(
            (containerData.Config.Image === config.imageName)
        );
    }

    private ParsePortBindings(containerData: DockerContainerInfo): DockerContainerConfigPortMapping[]
    {
        const result: DockerContainerConfigPortMapping[] = [];
        for (const containerBinding in containerData.HostConfig.PortBindings)
        {
            if (Object.prototype.hasOwnProperty.call(containerData.HostConfig.PortBindings, containerBinding))
            {
                const hostBinding = containerData.HostConfig.PortBindings[containerBinding]!;

                const containerPort = parseInt(containerBinding.split("/")[0]);

                hostBinding.forEach(x => result.push({
                    containerPort,
                    hostPost: parseInt(x.HostPort)
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