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

import { Dictionary, ObjectExtensions } from "acts-util-core";
import { Injectable } from "acts-util-node";
import { ConfigDialect } from "../common/config/ConfigDialect";
import { ConfigModel } from "../common/config/ConfigModel";
import { ConfigParser } from "../common/config/ConfigParser";
import { RemoteCommandExecutor } from "./RemoteCommandExecutor";
import { RemoteRootFileSystemManager } from "./RemoteRootFileSystemManager";
import { RemoteFileSystemManager } from "./RemoteFileSystemManager";

type SystemServiceAction = "disable" | "enable" | "restart" | "start" | "stop";

interface ServiceProperties
{
    before: string[];
    command: string;
    environment: Dictionary<string>;
    groupName: string;
    name: string;
    userName: string;
}

@Injectable
export class SystemServicesManager
{
    constructor(private remoteCommandExecutor: RemoteCommandExecutor, private remoteRootFileSystemManager: RemoteRootFileSystemManager, private remoteFileSystemManager: RemoteFileSystemManager)
    {
    }

    //Public methods
    public async CreateOrUpdateService(hostId: number, props: ServiceProperties)
    {
        const env = ObjectExtensions.Entries(props.environment).Map(x => "Environment=" + x.key + "=" + x.value).Join("\n");
        const before = (props.before.length === 0) ? "" : ("Before=" + props.before.join(" "))
        const text = `
[Unit]
Description=${props.name} Service
Wants=network.target
After=network.target
${before}
    
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

    public async DoesServiceUnitExist(hostId: number, serviceName: string)
    {
        const unitPath = "/etc/systemd/system/" + serviceName + ".service";
        const exists = await this.remoteFileSystemManager.Exists(hostId, unitPath)
        return exists;
    }

    public EnableService(hostId: number, serviceName: string)
    {
        return this.ExecuteServiceAction(hostId, serviceName, "enable");
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
        const result = await this.remoteCommandExecutor.ExecuteBufferedCommandWithExitCode(["sudo", "systemctl", "status", serviceName + ".service", "--lines", "100"], hostId);
        return result.stdOut;
    }

    public async ReadServiceUnit(hostId: number, serviceName: string): Promise<ServiceProperties>
    {
        const dialect: ConfigDialect = {
            commentInitiators: [],
        };
        const parser = new ConfigParser(dialect);
        const data = await parser.Parse(hostId, "/etc/systemd/system/" + serviceName + ".service");
        const model = new ConfigModel(data);

        const before = model.GetProperty("Unit", "Before");
        return {
            before: (before === undefined) ? [] : before!.toString().split(" "),
            command: model.GetProperty("Service", "ExecStart")!.toString(),
            environment: data.Values().Map(x => (x.type === "KeyValue" &&  x.key === "Environment") ? x : null).NotNull().Map(x => x.value!.toString().split("=")).ToDictionary(x => x[0], x => x[1]),
            groupName: model.GetProperty("Service", "Group")!.toString(),
            name: serviceName,
            userName: model.GetProperty("Service", "User")!.toString(),
        };
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