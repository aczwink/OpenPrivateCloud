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
import { GlobalInjector, Injectable } from "acts-util-node";
import { ShellFrontend } from "../../common/ShellFrontend";
import { ShellWrapper } from "../../common/ShellWrapper";
import { ModulesManager } from "../../services/ModulesManager";
import { RemoteCommandExecutor } from "../../services/RemoteCommandExecutor";
import { LetsEncryptManager } from "../web-services/LetsEncryptManager";

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
    /**
     * @title Certificate
     * @format instance-same-host[web-services/letsencrypt-cert]
     */
    certFullInstanceName?: string;

    env: EnvironmentVariableMapping[];
    imageName: string;
    portMap: PortMapping[];
    restartPolicy: "always" | "no";
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
    constructor(private modulesManager: ModulesManager, private remoteCommandExecutor: RemoteCommandExecutor)
    {
    }

    //Public methods
    public async CreateContainerInstanceAndAutoStart(hostId: number, containerName: string, config: DockerContainerConfig)
    {
        await this.EnsureDockerIsInstalled(hostId);

        const readOnlyVolumes = [];
        if(config.certFullInstanceName)
        {
            const lem = GlobalInjector.Resolve(LetsEncryptManager);
            const cert = await lem.GetCert(hostId, config.certFullInstanceName);

            readOnlyVolumes.push("-v", cert.certificatePath + ":/certs/public.crt:ro");
            readOnlyVolumes.push("-v", cert.privateKeyPath + ":/certs/private.key:ro");
        }

        const envArgs = config.env.Values().Map(x => ["-e", x.varName + "=" + x.value].Values()).Flatten().ToArray();
        const portArgs = config.portMap.Values().Map(x => ["-p", x.hostPost + ":" + x.containerPort].Values()).Flatten().ToArray();

        const cmdArgs = [
            "--name", containerName,
            ...envArgs,
            ...portArgs,
            ...readOnlyVolumes,
            "--restart", config.restartPolicy,
            config.imageName
        ];

        await this.remoteCommandExecutor.ExecuteCommand(["sudo", "docker", "container", "create", ...cmdArgs], hostId);
        await this.remoteCommandExecutor.ExecuteCommand(["sudo", "docker", "container", "start", containerName], hostId);
    }

    public async DeleteContainer(hostId: number, containerName: string)
    {
        await this.remoteCommandExecutor.ExecuteCommand(["sudo", "docker", "rm", containerName], hostId);
    }

    public async EnsureDockerIsInstalled(hostId: number)
    {
        await this.modulesManager.EnsureModuleIsInstalled(hostId, "docker");
    }

    public async InspectContainer(hostId: number, containerName: string)
    {
        const result = await this.remoteCommandExecutor.ExecuteBufferedCommandWithExitCode(["sudo", "docker", "container", "inspect", containerName], hostId);
        if(result.exitCode === 1)
            return undefined;

        const data = JSON.parse(result.stdOut) as any[];
        if(data.length === 0)
            return undefined;

        return data[0] as DockerContainerInfo;
    }

    public async PullImage(hostId: number, imageName: string)
    {
        await this.remoteCommandExecutor.ExecuteCommand(["sudo", "docker", "pull", imageName], hostId);
    }

    public async SpawnShell(hostId: number, containerName: string, shellType: "sh" = "sh")
    {
        const hostShell = await this.remoteCommandExecutor.SpawnRawShell(hostId);
        const hostShellFrontend = new ShellFrontend(hostShell);
        await hostShellFrontend.ExecuteCommand(["sudo", "docker", "exec", "--interactive", "-t", "-e", "PS1=$\\ ", containerName, shellType]);

        const containerShell: ShellWrapper = {
            Close: async () => {
                await hostShellFrontend.ExecuteCommand(["exit"]); //exit out of container
                return hostShell.Close();
            },
            RegisterForDataEvents: callback => hostShell.RegisterForDataEvents(callback),
            SendInput: data => hostShell.SendInput(data),
            StartCommand: command => hostShell.StartCommand(command),
            WaitForCommandToFinish: () => hostShell.WaitForCommandToFinish(),
            WaitForStandardPrompt: () => hostShell.WaitForStandardPrompt(),
        };

        return new ShellFrontend(containerShell);
    }

    public async StopContainer(hostId: number, containerName: string)
    {
        await this.remoteCommandExecutor.ExecuteCommand(["sudo", "docker", "container", "stop", containerName], hostId);
    }
}