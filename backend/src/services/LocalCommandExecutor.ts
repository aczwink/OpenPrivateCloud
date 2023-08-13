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
import child_process from "child_process";
import { Injectable } from "acts-util-node";
import { TimeUtil } from "acts-util-core";

interface CommandExecutionResult
{
    exitCode: number;
    stdout: string;
    stderr: string;
}

@Injectable
export class LocalCommandExecutor
{
    //Public methods
    public async ExecuteCommand(command: string[], expectedExitCode: number = 0)
    {
        const result = await this.ExecuteCommandWithExitCode(command);
        if(result.exitCode !== expectedExitCode)
            throw new Error("Command '" + command.join(" ") + "' failed. stderr: " + result.stderr);

        return result;
    }

    public async ExecuteCommandWithoutEncoding(command: string[])
    {
        const commandLine = command.join(" ");
        const childProcess = child_process.spawn(commandLine, [], {
            shell: true,
        });

        const buffers: Buffer[] = [];
        childProcess.stdout.on("data", buffer => buffers.push(buffer));

        const exitCode = await this.ChildProcessToPromise(childProcess);
        if(exitCode !== 0)
            throw new Error("Command '" + command.join(" ") + "' failed.");

        return Buffer.concat(buffers);
    }

    //Private methods
    private ChildProcessToPromise(childProcess: child_process.ChildProcessWithoutNullStreams)
    {
        return new Promise<number>( (resolve, reject) => {
            childProcess.on("close", (code, _) => resolve(code!));
            childProcess.on("error", reject);
        });
    }

    private CreateChildProcess(command: string[])
    {
        const commandLine = command.join(" ");
        const childProcess = child_process.spawn(commandLine, [], {
            //cwd: options.workingDirectory,
            //env: options.environmentVariables,
            //gid: auth.gid,
            shell: true,
            //uid: auth.uid,
        });

        /*if(sudo)
        {
            childProcess.stdin.setDefaultEncoding("utf-8");
            childProcess.stdin.write(this.sessionManager.password + "\n");
        }*/

        childProcess.stdout.setEncoding("utf-8");
        childProcess.stdout.on("data", console.log);
        childProcess.stderr.setEncoding("utf-8");
        childProcess.stderr.on("data", console.error);

        //this.processTracker.RegisterProcess(childProcess, commandLine);

        return childProcess;
    }

    private async ExecuteCommandWithExitCode(command: string[]): Promise<CommandExecutionResult>
    {
        const childProcess = this.CreateChildProcess(command);

        let stdOut = "";
        childProcess.stdout.on("data", chunk => stdOut += chunk);

        let stdErr = "";
        childProcess.stderr.on("data", chunk => stdErr += chunk);

        const exitCode = await this.ChildProcessToPromise(childProcess);

        return { exitCode, stderr: stdErr, stdout: stdOut };
    }
}