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
import { ClientChannel } from "ssh2";
import { ShellFrontend } from "../common/shell/ShellFrontend";
import { ShellWrapper } from "../common/shell/ShellWrapper";
import { SSHShellWrapper } from "../common/shell/SSHShellWrapper";
import { TracingShellWrapper } from "../common/shell/TracingShellWrapper";
import { ProcessTracker, ProcessTrackerManager } from "./ProcessTrackerManager";
import { SSHConnection, Command } from "./SSHService";

interface CommandOptions
{
    hostIdOrHostName: number | string;
    workingDirectory?: string;
}

export interface CommandResult
{
    stdErr: string;
    stdOut: string;
}

export interface CommandResultWithExitCode extends CommandResult
{
    exitCode: number;
}

@Injectable
export class SSHCommandExecutor
{
    constructor(private processTrackerManager: ProcessTrackerManager)
    {
    }

    //Public methods
    public async ExecuteBufferedCommand(connection: SSHConnection, command: string[], options: CommandOptions): Promise<CommandResult>
    {
        const result = await this.ExecuteBufferedCommandInternal(connection, command, options);
        if(result.exitCode !== 0)
        {
            result.tracker.Fail(result.exitCode);
            throw new Error("Command failed with exitCode: " + result.exitCode + ". Command: " + this.CommandToString(command).commandLine);
        }
        result.tracker.Finish();

        return {
            stdErr: result.stdErr,
            stdOut: result.stdOut
        };
    }

    public async ExecuteBufferedCommandWithExitCode(connection: SSHConnection, command: string[], options: CommandOptions): Promise<CommandResultWithExitCode>
    {
        const result = await this.ExecuteBufferedCommandInternal(connection, command, options);
        result.tracker.Finish();

        return {
            exitCode: result.exitCode,
            stdErr: result.stdErr,
            stdOut: result.stdOut
        };
    }

    public async ExecuteCommand(connection: SSHConnection, command: Command, options: CommandOptions)
    {
        const tracker = await this.CreateTracker(command, options);

        if(options.workingDirectory !== undefined)
        {
            await this.ExecuteCommandUsingShell(connection, command, options);
            tracker.Finish();
            return 0; //no exit code available :(
        }

        const exitCode = await this.ExecuteCommandAsSingleCommand(connection, command, options, tracker);
        if(exitCode !== 0)
        {
            tracker.Fail(exitCode);
            throw new Error("Command failed with exitCode: " + exitCode + ". Command: " + this.CommandToString(command).commandLine);
        }
        tracker.Finish();
    }

    public async ExecuteCommandWithExitCode(connection: SSHConnection, command: Command, options: CommandOptions)
    {
        const tracker = await this.CreateTracker(command, options);

        if(options.workingDirectory !== undefined)
        {
            await this.ExecuteCommandUsingShell(connection, command, options);
            tracker.Finish();
            return 0; //no exit code available :(
        }

        const exitCode = await this.ExecuteCommandAsSingleCommand(connection, command, options, tracker);
        tracker.Finish();
        return exitCode;
    }

    public async _LegacySpawnRawShell(connection: SSHConnection, onClose: Function, hostId: number): Promise<ShellWrapper>
    {
        const channel = await connection.SpawnShell();

        channel.stderr.setEncoding("utf-8");
        channel.stdout.setEncoding("utf-8");

        channel.stderr.on("data", chunk => process.stderr.write(chunk));
        channel.on("close", onClose);
        //channel.stdout.on("data", (chunk: any) => process.stdout.write(chunk));

        let shell: ShellWrapper = new SSHShellWrapper(channel, hostId);
        await shell.WaitForStandardPrompt();
        shell = new TracingShellWrapper(shell, hostId, this.processTrackerManager);

        return shell;
    }

    public async _LegacySpawnShell(connection: SSHConnection, onClose: Function, hostId: number): Promise<ShellFrontend>
    {
        return new ShellFrontend(await this._LegacySpawnRawShell(connection, onClose, hostId));
    }

    //Private methods
    private async CreateTracker(command: Command, options: CommandOptions)
    {
        return await this.processTrackerManager.Create(options.hostIdOrHostName, this.CommandToString(command).commandLine);
    }

    private async ExecuteBufferedCommandInternal(connection: SSHConnection, command: string[], options: CommandOptions)
    {
        const tracker = await this.CreateTracker(command, options);

        const cmd = this.CommandToString(command);
        const channel = await connection.ExecuteInteractiveCommand(cmd.commandLine, cmd.sudo);

        if(options.stdin !== undefined)
            channel.stdin.write(options.stdin);

        let stdOut = "";
        let stdErr = "";

        const exitCode = await new Promise<number>( (resolve, reject) => {
            channel.stdout.setEncoding("utf-8");
            channel.stderr.setEncoding("utf-8");

            channel.stdout.on("data", (chunk: string) => {
                stdOut += chunk;
                tracker.Add(chunk);
            });
            channel.stderr.on("data", (chunk: string) => {
                stdErr += chunk;
                tracker.Add(chunk);
            });
            
            this.RegisterExitEvents(channel, tracker, resolve, reject);
        });

        return {
            exitCode: exitCode,
            stdErr,
            stdOut,
            tracker
        };
    }

    private async ExecuteCommandUsingShell(connection: SSHConnection, command: Command, options: CommandOptions)
    {
        const shell = await this._LegacySpawnShell(connection, () => null, options.hostIdOrHostName as number);
        await shell.ChangeDirectory(options.workingDirectory!);

        await shell.ExecuteCommand(command as string[]);

        await shell.Close();
    }
}