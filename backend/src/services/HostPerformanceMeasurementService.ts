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
import { RemoteFileSystemManager } from "./RemoteFileSystemManager";

interface PerformanceStats
{
    /**
     * in kilobytes
     */
    availableMemory: number;
    ping: number;
    /**
     * in kilobytes
     */
    totalMemory: number;
}

@Injectable
export class HostPerformanceMeasurementService
{
    constructor(private remoteCommandExecutor: RemoteCommandExecutor, private remoteFileSystemManager: RemoteFileSystemManager)
    {
    }

    //Public methods    
    public async QueryPerformanceStats(hostId: number): Promise<PerformanceStats>
    {
        const meminfo = await this.QueryMemoryInfo(hostId);

        return {
            availableMemory: meminfo.MemAvailable!,
            totalMemory: meminfo.MemTotal!,
            ping: await this.ExecutePing(hostId),
        };
    }

    //Private methods
    private async ExecutePing(hostId: number)
    {
        const t1 = Date.now();
        await this.remoteCommandExecutor.ExecuteCommand(["echo", "ping"], hostId);
        const t2 = Date.now();

        return t2 - t1;
    }

    private async QueryMemoryInfo(hostId: number)
    {
        const data = await this.remoteFileSystemManager.ReadTextFile(hostId, "/proc/meminfo");
        const lines = data.trimEnd().split("\n");

        const memData: Dictionary<number> = {};
        for (const line of lines)
        {
            const parts = line.split(/ +/);

            let scaled = parseInt(parts[1]);
            if(parts.length === 3)
            {
                if(parts[2] !== "kB")
                    throw new Error("Not implemented: " + parts.join(" "));
            }
            else
                scaled /= 1024;

            memData[parts[0].substring(0, parts[0].length - 1)] = scaled;
        }

        return memData;
    }
}