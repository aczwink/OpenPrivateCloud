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

import { Dictionary } from "acts-util-core";
import { Injectable } from "acts-util-node";
import { RemoteCommandExecutor } from "./RemoteCommandExecutor";

  
@Injectable
export class DistroInfoService
{
    constructor(private remoteCommandExecutor: RemoteCommandExecutor)
    {
    }

    //Public methods
    public async FetchCPU_Architecture(hostId: number): Promise<"amd64" | "arm64">
    {
        const result = await this.remoteCommandExecutor.ExecuteBufferedCommand(["dpkg", "--print-architecture"], hostId);
        return result.stdOut.trim() as any;
    }
    
    public async FetchDisplayName(hostId: number)
    {
        const result = await this.FetchFields(hostId);
        return result.PRETTY_NAME!;
    }

    public async FetchId(hostId: number)
    {
        const result = await this.FetchFields(hostId);
        return result.ID;
    }

    //Private methods
    private async FetchFields(hostId: number)
    {
        const fields = await this.remoteCommandExecutor.ExecuteBufferedCommand(["cat", "/etc/*release"], hostId);
        const lines = fields.stdOut.split("\n");
        const result: Dictionary<string> = {};

        for (let index = 0; index < lines.length; index++)
        {
            const line = lines[index].trim();
            const split = line.split("=");
            if(split.length === 2)
            {
                let value = split[1].trim();
                if( (value.length >= 2) && (value[0] == '"') && (value[value.length-1] == '"') )
                    value = value.substr(1, value.length - 2);
                result[split[0]] = value;
            }
        }

        return result;
    }
}