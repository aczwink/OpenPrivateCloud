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
import { Injectable } from "acts-util-node";
import { RemoteConnectionsManager } from "./RemoteConnectionsManager";
import { Command } from "./SSHService";
import { SSHCommandExecutor } from "./SSHCommandExecutor";
import { ShellFrontend2, g_PS1 } from "../common/shell/ShellFrontEnd2";
import { SSHShellInterface } from "../common/shell/SSHShellWrapper";

interface CommandOptions
{
    stdin?: string;
    workingDirectory?: string;
}

@Injectable
export class RemoteCommandExecutor
{
    constructor(private remoteConnectionsManager: RemoteConnectionsManager, private sshCommandExecutor: SSHCommandExecutor)
    {
    }

    //Public methods
    public async ExecuteCommand(command: Command, hostId: number, options?: CommandOptions)
    {
        const conn = await this.remoteConnectionsManager.AcquireConnection(hostId);
        try
        {
            await this.sshCommandExecutor.ExecuteCommand(conn.value, command, {
                hostIdOrHostName: hostId,
                stdin: options?.stdin,
                workingDirectory: options?.workingDirectory,
            });
        }
        finally
        {
            conn.Release();
        }
    }

    public async ExecuteBufferedCommand(command: string[], hostId: number)
    {
        const conn = await this.remoteConnectionsManager.AcquireConnection(hostId);
        try
        {
            const result = await this.sshCommandExecutor.ExecuteBufferedCommand(conn.value, command, { hostIdOrHostName: hostId });
            return result;
        }
        finally
        {
            conn.Release();
        }
    }

    public async ExecuteBufferedCommandWithExitCode(command: string[], hostId: number)
    {
        const conn = await this.remoteConnectionsManager.AcquireConnection(hostId);
        const result = await this.sshCommandExecutor.ExecuteBufferedCommandWithExitCode(conn.value, command, { hostIdOrHostName: hostId });
        conn.Release();

        return result;
    }

    public async ExecuteCommandWithExitCode(command: Command, hostId: number, options?: CommandOptions)
    {
        const conn = await this.remoteConnectionsManager.AcquireConnection(hostId);
        const exitCode = await this.sshCommandExecutor.ExecuteCommandWithExitCode(conn.value, command, {
            hostIdOrHostName: hostId,
            stdin: options?.stdin,
            workingDirectory: options?.workingDirectory
        });
        conn.Release();
        return exitCode;
    }

    public async SpawnRawShell(hostId: number)
    {
        const conn = await this.remoteConnectionsManager.AcquireConnection(hostId);

        const channel = await conn.value.SpawnShell();
        channel.write('PS1="' + g_PS1 + '"; export PS1\n');
        channel.on("close", () => conn.Release());

        return new SSHShellInterface(channel);
    }

    public async SpawnShell(hostId: number)
    {
        const shellInterface = await this.SpawnRawShell(hostId);

        return new ShellFrontend2(shellInterface, hostId);
    }

    public async _LegacySpawnShell(hostId: number)
    {
        const conn = await this.remoteConnectionsManager.AcquireConnection(hostId);

        return this.sshCommandExecutor._LegacySpawnShell(conn.value, () => conn.Release(), hostId);
    }
}