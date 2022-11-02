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
import { RemoteConnectionsManager } from "./RemoteConnectionsManager";
import { Command } from "./SSHService";

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
}