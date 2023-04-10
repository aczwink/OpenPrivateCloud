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

import { Injectable } from "acts-util-node";
import { RemoteFileSystemManager } from "./RemoteFileSystemManager";

export interface NetworkStat
{
    interfaceName: string;
    bytesReadCount: number;
    bytesTransmittedCount: number;
}

@Injectable
export class HostMetricsService
{
    constructor(private remoteFileSystemManager: RemoteFileSystemManager)
    {
        
    }
    //Public methods
    public async ReadNetworkStatistics(hostId: number)
    {
        const data = await this.remoteFileSystemManager.ReadTextFile(hostId, "/proc/net/dev");
        const lines = data.trimEnd().split("\n");

        const result: NetworkStat[] = [];
        for (const line of lines.slice(2))
        {
            const parts = line.trimStart().split(/[ \t]+/);

            result.push({
                bytesReadCount: parseInt(parts[1]),
                bytesTransmittedCount: parseInt(parts[9]),
                interfaceName: parts[0].substring(0, parts[0].length - 1)
            });
        }

        return result;
    }
}