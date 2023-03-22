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
import { InstanceContext } from "../../common/InstanceContext";
import { InstanceConfigController } from "../../data-access/InstanceConfigController";
import { InstancesManager } from "../../services/InstancesManager";
import { RemoteCommandExecutor } from "../../services/RemoteCommandExecutor";
import { ResourceDeletionError } from "../ResourceProvider";
import { DockerContainerConfig, DockerManager } from "./DockerManager";

@Injectable
export class DockerContainerManager
{
    constructor(private remoteCommandExecutor: RemoteCommandExecutor, private dockerManager: DockerManager,
        private instanceConfigController: InstanceConfigController, private instancesManager: InstancesManager)
    {
    }

    //Public methods
    public async DeleteResource(hostId: number, instanceName: string): Promise<ResourceDeletionError | null>
    {
        const containerInfo = await this.dockerManager.InspectContainer(hostId, instanceName);
        if(containerInfo === undefined)
            return null;

        if(containerInfo.State.Running)
        {
            return {
                type: "ConflictingState",
                message: "The container is running. Shut it down before deleting it."
            };
        }
        await this.dockerManager.DeleteContainer(hostId, instanceName);

        return null;
    }

    public async ExecuteAction(instanceContext: InstanceContext, action: "start" | "shutdown")
    {
        switch(action)
        {
            case "shutdown":
                const parts = this.instancesManager.ExtractPartsFromFullInstanceName(instanceContext.fullInstanceName);
                await this.dockerManager.StopContainer(instanceContext.hostId, parts.instanceName);
                break;
            case "start":
                await this.StartContainer(instanceContext);
                break;
        }
    }

    public async QueryContainerConfig(instanceId: number): Promise<DockerContainerConfig>
    {
        const config = await this.instanceConfigController.QueryConfig<DockerContainerConfig>(instanceId);
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

    public async QueryContainerStatus(hostId: number, instanceName: string)
    {
        const containerData = await this.dockerManager.InspectContainer(hostId, instanceName);
        if(containerData === undefined)
            return "not created yet";

        return containerData.State.Status;
    }

    public async QueryLog(hostId: number, instanceName: string)
    {
        const result = await this.remoteCommandExecutor.ExecuteBufferedCommandWithExitCode(["sudo", "docker", "container", "logs", instanceName], hostId);
        return result;
    }

    public async UpdateContainerConfig(instanceId: number, config: DockerContainerConfig)
    {
        await this.instanceConfigController.UpdateOrInsertConfig(instanceId, config);
    }

    public async UpdateContainerImage(instanceContext: InstanceContext)
    {
        const parts = this.instancesManager.ExtractPartsFromFullInstanceName(instanceContext.fullInstanceName);
        const containerData = await this.dockerManager.InspectContainer(instanceContext.hostId, parts.instanceName);
        if(containerData?.State.Running)
            throw new Error("Container is running");

        const config = await this.QueryContainerConfig(instanceContext.instanceId);
        await this.dockerManager.PullImage(instanceContext.hostId, config.imageName);
    }

    //Private methods
    private async StartContainer(instanceContext: InstanceContext)
    {
        const parts = this.instancesManager.ExtractPartsFromFullInstanceName(instanceContext.fullInstanceName);
        const config = await this.QueryContainerConfig(instanceContext.instanceId);

        const containerData = await this.dockerManager.InspectContainer(instanceContext.hostId, parts.instanceName);
        if(containerData !== undefined)
        {
            await this.dockerManager.DeleteContainer(instanceContext.hostId, parts.instanceName);
        }

        await this.dockerManager.CreateContainerInstanceAndAutoStart(instanceContext.hostId, parts.instanceName, config);
    }
}