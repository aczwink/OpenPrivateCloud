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

@Injectable
export class LocalCommandExecutor
{
    //Public methods
    public async ExecuteCommandWithoutEncoding(command: string[])
    {
        const commandLine = command.join(" ");
        const childProcess = child_process.spawn(commandLine, [], {
            shell: true,
        });

        const buffers: Buffer[] = [];
        childProcess.stderr.on("data", x => console.error(x.toString("utf-8")));
        childProcess.stdout.on("data", buffer => buffers.push(buffer));

        const exitCode = await this.ChildProcessToPromise(childProcess);
        if(exitCode !== 0)
            throw new Error("Command '" + command.join(" ") + "' failed.");

        return Buffer.concat(buffers);
    }
}