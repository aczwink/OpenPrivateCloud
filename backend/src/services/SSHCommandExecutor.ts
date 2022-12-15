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
import { ClientChannel } from "ssh2";
import { ShellWrapper, ShellWrapperImpl } from "../common/ShellWrapper";
import { ProcessTracker, ProcessTrackerManager } from "./ProcessTrackerManager";
import { SSHConnection, Command } from "./SSHService";

interface CommandOptions
{
    hostId: number;
    stdin?: string;
    workingDirectory?: string;
}

export interface CommandResult
{
    exitCode: number;
    stdErr: string;
    stdOut: string;
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
        const tracker = this.CreateTracker(command, options);

        const cmd = this.CommandToString(command);
        const channel = await connection.ExecuteInteractiveCommand(cmd.commandLine, cmd.sudo);

        let stdOut = "";
        let stdErr = "";

        const exitCodeString = await new Promise<string>( (resolve, reject) => {
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
            exitCode: this.ParseExitCode(exitCodeString),
            stdErr,
            stdOut
        };
    }

    public async ExecuteCommand(connection: SSHConnection, command: Command, options: CommandOptions)
    {
        const exitCode = await this.ExecuteCommandWithExitCode(connection, command, options);
        if(exitCode !== 0)
            throw new Error("Command failed with exitCode: " + exitCode + ". Command: " + this.CommandToString(command).commandLine);
    }

    public async ExecuteCommandWithExitCode(connection: SSHConnection, command: Command, options: CommandOptions)
    {
        if(options.workingDirectory !== undefined)
            return this.ExecuteCommandWithExitCodeUsingShell(connection, command, options);

        const tracker = this.CreateTracker(command, options);

        const cmd = this.CommandToString(command);
        const channel = await connection.ExecuteInteractiveCommand(cmd.commandLine, cmd.sudo);

        if(options.stdin !== undefined)
            channel.stdin.write(options.stdin);

        const exitCodeString = await new Promise<string>( (resolve, reject) => {
            channel.stdout.setEncoding("utf-8");
            channel.stderr.setEncoding("utf-8");

            channel.stdout.on("data", tracker.Add.bind(tracker));
            channel.stderr.on("data", tracker.Add.bind(tracker));
            
            this.RegisterExitEvents(channel, tracker, resolve, reject);
        });

        return this.ParseExitCode(exitCodeString);
    }

    public async SpawnShell(connection: SSHConnection, onClose: Function, hostId: number): Promise<ShellWrapper>
    {
        const channel = await connection.SpawnShell();

        channel.stderr.setEncoding("utf-8");
        channel.stdout.setEncoding("utf-8");

        channel.on("close", onClose);
        channel.stderr.on("data", chunk => process.stderr.write(chunk));
        channel.stdout.on("data", (chunk: any) => process.stdout.write(chunk));

        const shell = new ShellWrapperImpl(channel, hostId);
        await shell.WaitForStandardPrompt();
        return shell;
    }

    //Private methods
    private CommandToString(command: Command): { commandLine: string; sudo: boolean }
    {
        if(Array.isArray(command))
        {
            if(command[0] === "sudo")
            {
                command.splice(1, 0, "--stdin");
            }
            return {
                commandLine: command.join(" "),
                sudo: command[0] === "sudo"
            };
        }

        let op;
        switch(command.type)
        {
            case "pipe":
                op = "|";
                break;
            case "redirect-stdout":
                op = ">";
                break;
        }

        const nested = this.CommandToString(command.source).commandLine + " " + op + " " + this.CommandToString(command.target).commandLine;

        return {
            commandLine: (command.sudo === true ? "sudo --stdin sh -c '" + nested + "'" : nested),
            sudo: command.sudo === true
        }
    }

    private CreateTracker(command: Command, options: CommandOptions)
    {
        return this.processTrackerManager.Create("Host: " + options.hostId + " | " + this.CommandToString(command).commandLine);
    }

    private async ExecuteCommandWithExitCodeUsingShell(connection: SSHConnection, command: Command, options: CommandOptions)
    {
        const shell = await this.SpawnShell(connection, () => null, options.hostId);
        await shell.ChangeDirectory(options.workingDirectory!);

        await shell.ExecuteCommand(command as string[]);

        await shell.Close();

        return 0;
    }

    private ParseExitCode(exitCodeString: string)
    {
        const exitCode = parseInt(exitCodeString);
        return exitCode;
    }

    private RegisterExitEvents(channel: ClientChannel, tracker: ProcessTracker, resolve: (value: string) => void, reject: (reason: any) => void)
    {
        channel.on("error", reject);
        channel.on("exit", code => {
            tracker.Add("Process exit code is:", code);
            tracker.Finish();
            resolve(code);
        });
        channel.on("close", (code: any, signal: any) => {
            tracker.Add("Processed closed.", code, signal);
            tracker.Finish();
            resolve(code);
        });
    }
}