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

import { Dictionary } from "acts-util-core";
import { Injectable } from "acts-util-node";
import { RemoteCommandExecutor } from "./RemoteCommandExecutor";
import { RemoteRootFileSystemManager } from "./RemoteRootFileSystemManager";

type SystemServiceAction = "disable" | "enable" | "restart" | "start" | "stop";

interface ServiceProperties
{
    command: string;
    environment: Dictionary<string>;
    groupName: string;
    name: string;
    userName: string;
}

@Injectable
export class SystemServicesManager
{
    constructor(private remoteCommandExecutor: RemoteCommandExecutor, private remoteRootFileSystemManager: RemoteRootFileSystemManager)
    {
    }

    //Public methods
    public async CreateService(hostId: number, props: ServiceProperties)
    {
        const env = props.environment.Entries().Map(x => "Environment=" + x.key + "=" + x.value).Join("\n");
        const text = `
[Unit]
Description=${props.name} Service
Wants=network.target
After=network.target
    
[Service]
${env}
Type=simple
RemainAfterExit=yes
ExecStart=${props.command}
User=${props.userName}
Group=${props.groupName}
    
[Install]
WantedBy=multi-user.target
        `;
        await this.remoteRootFileSystemManager.WriteTextFile(hostId, "/etc/systemd/system/" + props.name.toLowerCase() + ".service", text);
    }

    public async DeleteService(hostId: number, serviceName: string)
    {
        await this.remoteRootFileSystemManager.RemoveFile(hostId, "/etc/systemd/system/" + serviceName + ".service");
    }

    public DisableService(hostId: number, serviceName: string)
    {
        return this.ExecuteServiceAction(hostId, serviceName, "disable");
    }

    public async IsServiceActive(hostId: number, serviceName: string)
    {
        const exitCode = await this.remoteCommandExecutor.ExecuteCommandWithExitCode(["systemctl", "is-active", serviceName + ".service"], hostId);
        return exitCode === 0;
    }

    public async IsServiceEnabled(hostId: number, serviceName: string)
    {
        const exitCode = await this.remoteCommandExecutor.ExecuteCommandWithExitCode(["systemctl", "is-enabled", serviceName + ".service"], hostId);
        return exitCode === 0;
    }

    public async QueryStatus(hostId: number, serviceName: string)
    {
        const result = await this.remoteCommandExecutor.ExecuteBufferedCommand(["sudo", "systemctl", "status", serviceName + ".service", "--lines", "100"], hostId);
        return result.stdOut;
    }

    public async Reload(hostId: number)
    {
        await this.remoteCommandExecutor.ExecuteCommand(["sudo", "systemctl", "daemon-reload"], hostId);
    }

    public RestartService(hostId: number, serviceName: string)
    {
        return this.ExecuteServiceAction(hostId, serviceName, "restart");
    }

    public StartService(hostId: number, serviceName: string)
    {
        return this.ExecuteServiceAction(hostId, serviceName, "start");
    }

    public StopService(hostId: number, serviceName: string)
    {
        return this.ExecuteServiceAction(hostId, serviceName, "stop");
    }

    //Private methods
    private async ExecuteServiceAction(hostId: number, serviceName: string, action: SystemServiceAction)
    {
        await this.remoteCommandExecutor.ExecuteCommand(["sudo", "systemctl", action, serviceName + ".service"], hostId);
    }
}