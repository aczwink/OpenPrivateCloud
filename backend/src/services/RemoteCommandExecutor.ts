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
import ssh2 from "ssh2";
import { Injectable } from "acts-util-node";
import { RemoteConnectionsManager } from "./RemoteConnectionsManager";
import { Command } from "./SSHService";

interface Shell
{
    ChangeDirectory(targetDirectory: string): void;
    Close(): Promise<void>;
    SendCommand(command: string[]): void;
}

class ShellImpl implements Shell
{
    constructor(private channel: ssh2.ClientChannel)
    {
    }

    //Public methods
    public ChangeDirectory(targetDirectory: string): void
    {
        this.channel.write("cd " + targetDirectory + "\n");
    }

    public Close(): Promise<void>
    {
        this.channel.end("exit\n");
        return new Promise<void>( resolve => this.channel.on("exit", resolve) );
    }

    public SendCommand(command: string[]): void
    {
        const cmdLine = command.join(" ");
        this.channel.write(cmdLine + "\n", "utf-8");
    }
}

@Injectable
export class RemoteCommandExecutor
{
    constructor(private remoteConnectionsManager: RemoteConnectionsManager)
    {
    }

    //Public methods
    public async ExecuteCommand(command: Command, hostId: number)
    {
        const exitCode = await this.ExecuteCommandWithExitCode(command, hostId);
        if(exitCode !== 0)
            throw new Error("Command failed with exitCode: " + exitCode + ". Command: " + JSON.stringify(command));
    }

    public async ExecuteBufferedCommand(command: string[], hostId: number)
    {
        const conn = await this.remoteConnectionsManager.AcquireConnection(hostId);
        const result = await conn.value.ExecuteBufferedCommand(command);
        conn.Release();

        return result;
    }

    public async ExecuteCommandWithExitCode(command: Command, hostId: number)
    {
        const conn = await this.remoteConnectionsManager.AcquireConnection(hostId);
        const exitCodeString = await conn.value.ExecuteCommand(command);
        conn.Release();

        const exitCode = parseInt(exitCodeString);
        return exitCode;
    }

    public async SpawnShell(hostId: number): Promise<Shell>
    {
        const conn = await this.remoteConnectionsManager.AcquireConnection(hostId);

        const channel = await conn.value.SpawnShell();

        channel.stderr.setEncoding("utf-8");
        channel.stdout.setEncoding("utf-8");

        channel.on("close", () => conn.Release());
        channel.stderr.on("data", chunk => process.stderr.write(chunk));
        channel.stdout.on("data", (chunk: any) => process.stdout.write(chunk));

        return new ShellImpl(channel);
    }
}