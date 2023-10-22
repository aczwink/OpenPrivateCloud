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
import { ShellFrontend } from "../../common/ShellFrontend";
import { ShellWrapper } from "../../common/ShellWrapper";
import { ModulesManager } from "../../services/ModulesManager";
import { RemoteCommandExecutor } from "../../services/RemoteCommandExecutor";
import { Dictionary } from "acts-util-core";


type DockerCapability = "NET_ADMIN" | "SYS_ADMIN" | "SYS_NICE" | "SYS_TIME";

export interface DockerContainerConfigPortMapping
{
    hostPost: number;
    containerPort: number;
    protocol: "TCP" | "UDP";
}

export interface DockerContainerConfigVolume
{
    hostPath: string;
    containerPath: string;
    readOnly: boolean;
}

export interface DockerEnvironmentVariableMapping
{
    varName: string;
    value: string;
}

interface DockerHostEntry
{
    domainName: string;
    ipAddress: string;
}

export interface DockerContainerConfig
{
    additionalHosts: DockerHostEntry[];
    capabilities: DockerCapability[];
    dnsSearchDomains: string[];
    dnsServers: string[];
    env: DockerEnvironmentVariableMapping[];
    hostName?: string;
    imageName: string;
    /**
     * Only set when using ipvlan network
     */
    ipAddress?: string;
    /**
     * Set to undefined if using host network
     */
    macAddress?: string;
    networkName: string;
    portMap: DockerContainerConfigPortMapping[];
    privileged: boolean;
    removeOnExit: boolean;
    restartPolicy: "always" | "no";
    volumes: DockerContainerConfigVolume[];
}

interface DockerContainerInfoPortBinding
{
    HostIp: string;
    HostPort: string;
}

interface DockerContainerNetwork
{
    IPAddress: string;
    MacAddress: string;
}

export interface DockerContainerInfo
{
    HostConfig: {
        PortBindings: Dictionary<DockerContainerInfoPortBinding[]>;
    };

    Config: {
        Env: string[];
        Image: string;
    };

    NetworkSettings: {
        Networks: Dictionary<DockerContainerNetwork>;
    };

    State: {
        Status: "created" | "exited" | "restarting" | "running";
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
    public async CreateContainerInstance(hostId: number, containerName: string, config: DockerContainerConfig)
    {
        await this.EnsureDockerIsInstalled(hostId);
        const cmdArgs = this.CreateArgs(containerName, config);
        await this.remoteCommandExecutor.ExecuteCommand(["sudo", "docker", "container", "create", ...cmdArgs, config.imageName], hostId);
    }

    public async CreateContainerInstanceAndStart(hostId: number, containerName: string, config: DockerContainerConfig)
    {
        await this.CreateContainerInstance(hostId, containerName, config);
        await this.StartExistingContainer(hostId, containerName);
    }

    public async CreateContainerInstanceAndStartItAndExecuteCommand(hostId: number, containerName: string, config: DockerContainerConfig, command: string[])
    {
        await this.EnsureDockerIsInstalled(hostId);
        const cmdArgs = this.CreateArgs(containerName, config);
        await this.remoteCommandExecutor.ExecuteCommand(["sudo", "docker", "container", "run", ...cmdArgs, config.imageName, ...command], hostId);
    }

    public CreateMAC_Address(globallyUniqueNumber: number)
    {
        function OctetToString(octet: number)
        {
            const str = octet.toString(16);
            if(str.length === 1)
                return "0" + str;
            return str;
        }

        //this is a variation of the standard docker function "generateMacAddr" in the bridge driver
        const macAddress = [
            0x02, 0x42, (globallyUniqueNumber >>> 24), ((globallyUniqueNumber >> 16) & 0xFF), ((globallyUniqueNumber >> 8) & 0xFF), (globallyUniqueNumber & 0xFF)
        ];

        return macAddress.map(OctetToString).join(":");
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

    public async QueryContainerLogs(hostId: number, containerName: string)
    {
        const result = await this.remoteCommandExecutor.ExecuteBufferedCommandWithExitCode(["sudo", "docker", "container", "logs", containerName], hostId);
        return result;
    }

    public async RestartContainer(hostId: number, containerName: string)
    {
        await this.remoteCommandExecutor.ExecuteCommand(["sudo", "docker", "container", "restart", containerName], hostId);
    }

    public async SpawnShell(hostId: number, containerName: string, shellType: "sh" = "sh")
    {
        const data = await this.InspectContainer(hostId, containerName);
        if(data === undefined)
            throw new Error("Container is not there. Can't spawn shell."); //TODO: because of the bad shell implementation, we need to track this beforehand :S

        const hostShell = await this.remoteCommandExecutor.SpawnRawShell(hostId);
        const hostShellFrontend = new ShellFrontend(hostShell);
        await hostShellFrontend.ExecuteCommand(["sudo", "docker", "exec", "--interactive", "-t", "-e", 'PS1="$ "', containerName, shellType]);

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

    public async StartExistingContainer(hostId: number, containerName: string)
    {
        await this.remoteCommandExecutor.ExecuteCommand(["sudo", "docker", "container", "start", containerName], hostId);
    }

    public async StopContainer(hostId: number, containerName: string)
    {
        await this.remoteCommandExecutor.ExecuteCommand(["sudo", "docker", "container", "stop", containerName], hostId);
    }

    //Private methods
    private CreateArgs(containerName: string, config: DockerContainerConfig)
    {
        const addHostsArgs = config.additionalHosts.map(x => "--add-host=" + x.domainName + ":" + x.ipAddress);
        const capsArgs = config.capabilities.map(x => "--cap-add=" + x);
        const dnsSearchDomainArgs = config.dnsSearchDomains.map(x => "--dns-search=" + x);
        const dnsServerArgs = config.dnsServers.map(x => "--dns=" + x);
        const envArgs = config.env.Values().Map(x => ["-e", x.varName + "=" + x.value].Values()).Flatten().ToArray();
        const hostNameArgs = (config.hostName === undefined) ? [] : ["-h", config.hostName];
        const ipAddressArgs = (config.ipAddress === undefined) ? [] : ["--ip", config.ipAddress];
        const macAddressArgs = (config.macAddress === undefined) ? [] : ["--mac-address", config.macAddress];
        const portArgs = config.portMap.Values().Map(x => ["-p", x.hostPost + ":" + x.containerPort + "/" + x.protocol.toLowerCase()].Values()).Flatten().ToArray();
        const privilegedArgs = config.privileged ? ["--privileged"] : [];
        const removeOnExitArgs = (config.removeOnExit === false) ? [] : ["--rm"];
        const volArgs = config.volumes.Values().Map(x => ["-v", x.hostPath + ":" + x.containerPath + (x.readOnly ? ":ro" : "")].Values()).Flatten().ToArray();

        const cmdArgs = [
            "--name", containerName,
            ...addHostsArgs,
            ...capsArgs,
            ...dnsSearchDomainArgs,
            ...dnsServerArgs,
            ...envArgs,
            ...hostNameArgs,
            ...portArgs,
            ...privilegedArgs,
            ...removeOnExitArgs,
            ...volArgs,
            ...ipAddressArgs,
            ...macAddressArgs,
            "--net", config.networkName,
            "--restart", config.restartPolicy,
        ];

        return cmdArgs;
    }
}