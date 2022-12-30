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
import { InstanceContext } from "../../common/InstanceContext";
import { InstanceConfigController } from "../../data-access/InstanceConfigController";
import { InstancesManager } from "../../services/InstancesManager";
import { ModulesManager } from "../../services/ModulesManager";
import { RemoteCommandExecutor } from "../../services/RemoteCommandExecutor";
import { DeploymentContext, ResourceDeletionError } from "../ResourceProvider";
import { DockerContainerProperties } from "./Properties";

interface EnvironmentVariableMapping
{
    varName: string;
    value: string;
}

interface PortMapping
{
    hostPost: number;
    containerPort: number;
}

export interface DockerContainerConfig
{
    env: EnvironmentVariableMapping[];
    imageName: string;
    portMap: PortMapping[];
}

interface DockerContainerInfo
{
    Config: {
        Image: string;
    };

    State: {
        Status: string;
        Running: boolean;
    };
}

@Injectable
export class DockerManager
{
    constructor(private modulesManager: ModulesManager, private remoteCommandExecutor: RemoteCommandExecutor,
        private instanceConfigController: InstanceConfigController, private instancesManager: InstancesManager)
    {
    }

    //Public methods
    public async DeleteResource(hostId: number, instanceName: string): Promise<ResourceDeletionError | null>
    {
        const containerInfo = await this.InspectContainer(hostId, instanceName);
        if(containerInfo === undefined)
            return null;

        if(containerInfo.State.Running)
        {
            return {
                type: "ConflictingState",
                message: "The container is running. Shut it down before deleting it."
            };
        }
        await this.DeleteContainer(hostId, instanceName);

        return null;
    }

    public async ExecuteAction(instanceContext: InstanceContext, action: "start" | "shutdown")
    {
        switch(action)
        {
            case "shutdown":
                const parts = this.instancesManager.ExtractPartsFromFullInstanceName(instanceContext.fullInstanceName);
                await this.remoteCommandExecutor.ExecuteCommand(["sudo", "docker", "container", "stop", parts.instanceName], instanceContext.hostId);
                break;
            case "start":
                await this.StartContainer(instanceContext);
                break;
        }
    }

    public async ProvideResource(instanceProperties: DockerContainerProperties, context: DeploymentContext)
    {
        await this.modulesManager.EnsureModuleIsInstalled(context.hostId, "docker");
    }

    public async QueryContainerConfig(instanceId: number): Promise<DockerContainerConfig>
    {
        const config = await this.instanceConfigController.QueryConfig<DockerContainerConfig>(instanceId);
        if(config === undefined)
        {
            return {
                env: [],
                imageName: "",
                portMap: []
            };
        }

        return config;
    }

    public async QueryContainerStatus(hostId: number, instanceName: string)
    {
        const containerData = await this.InspectContainer(hostId, instanceName);
        if(containerData === undefined)
            return "not created yet";

        return containerData.State.Status;
    }

    public async QueryLog(hostId: number, instanceName: string)
    {
        const result = await this.remoteCommandExecutor.ExecuteBufferedCommand(["sudo", "docker", "container", "logs", instanceName], hostId);
        return result;
    }

    public async UpdateContainerConfig(instanceId: number, config: DockerContainerConfig)
    {
        await this.instanceConfigController.UpdateOrInsertConfig(instanceId, config);
    }

    //Private methods
    private async DeleteContainer(hostId: number, instanceName: string)
    {
        await this.remoteCommandExecutor.ExecuteCommand(["sudo", "docker", "rm", instanceName], hostId);
    }

    private async InspectContainer(hostId: number, instanceName: string)
    {
        const result = await this.remoteCommandExecutor.ExecuteBufferedCommand(["sudo", "docker", "container", "inspect", instanceName], hostId);
        const data = JSON.parse(result.stdOut) as any[];

        if(data.length === 0)
            return undefined;
        return data[0] as DockerContainerInfo;
    }

    private async StartContainer(instanceContext: InstanceContext)
    {
        const parts = this.instancesManager.ExtractPartsFromFullInstanceName(instanceContext.fullInstanceName);
        const config = await this.QueryContainerConfig(instanceContext.instanceId);

        const containerData = await this.InspectContainer(instanceContext.hostId, parts.instanceName);
        if(containerData !== undefined)
        {
            await this.DeleteContainer(instanceContext.hostId, parts.instanceName);
        }

        const envArgs = config.env.Values().Map(x => ["-e", x.varName + "=" + x.value].Values()).Flatten().ToArray();
        const portArgs = config.portMap.Values().Map(x => ["-p", x.hostPost + ":" + x.containerPort].Values()).Flatten().ToArray();

        const cmdArgs = [
            "--name", parts.instanceName,
            ...envArgs,
            ...portArgs,
            config.imageName
        ];

        await this.remoteCommandExecutor.ExecuteCommand(["sudo", "docker", "container", "create", ...cmdArgs], instanceContext.hostId);
        await this.remoteCommandExecutor.ExecuteCommand(["sudo", "docker", "container", "start", parts.instanceName], instanceContext.hostId);
    }
}