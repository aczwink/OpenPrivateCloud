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
import { HostMetricsService, NetworkStat } from "./HostMetricsService";
import { RemoteCommandExecutor } from "./RemoteCommandExecutor";
import { RemoteFileSystemManager } from "./RemoteFileSystemManager";

interface CPUTimes
{
    idle: number;
    sum: number;
}

interface DiskStat
{
    deviceName: string;
    sectorsReadCount: number;
    sectorsWriteCount: number;
    currentlyInProgress: number;
}

interface JournalEntry
{
    MESSAGE: string;
    PRIORITY: string;
    SYSLOG_TIMESTAMP: string;
}

interface PerformanceStats
{
    /**
     * in kilobytes
     */
    availableMemory: number;

    /**
     * in percent
     */
    cpuUsage: number;

    diskUsage: number;

    networkUsage: number;

    ping: number;

    /**
     * in kilobytes
     */
    totalMemory: number;
}

@Injectable
export class HostPerformanceMeasurementService
{
    constructor(private remoteCommandExecutor: RemoteCommandExecutor, private remoteFileSystemManager: RemoteFileSystemManager, private hostMetricsService: HostMetricsService)
    {
        this.lastCPUTimes = {
            idle: 0,
            sum: 0
        };
        this.lastDiskStats = {
            deviceName: "",
            currentlyInProgress: 0,
            sectorsReadCount: 0,
            sectorsWriteCount: 0
        };
        this.lastNetworkStats = {
            bytesReadCount: 0,
            bytesTransmittedCount: 0,
            interfaceName: ""
        };
    }

    //Public methods
    public async QueryLogs(hostId: number)
    {
        const result = await this.remoteCommandExecutor.ExecuteBufferedCommand(["sudo", "journalctl", "--utc", "--no-pager", "-o", "json", "-n", "1000"], hostId);
        return result.stdOut.trimEnd().split("\n").map(x => JSON.parse(x) as JournalEntry);
    }

    public async QueryPerformanceStats(hostId: number): Promise<PerformanceStats>
    {
        const cpuUsage = await this.ComputeCPUUsage(hostId);
        const meminfo = await this.QueryMemoryInfo(hostId);
        const diskUsage = await this.QueryDiskUsage(hostId);
        const networkUsage = await this.QueryNetworkUsage(hostId);

        return {
            availableMemory: meminfo.MemAvailable!,
            cpuUsage,
            diskUsage: diskUsage.currentBytesRead + diskUsage.currentBytesWritten,
            networkUsage: networkUsage.currentBytesRead + networkUsage.currentBytesWritten,
            totalMemory: meminfo.MemTotal!,
            ping: await this.ExecutePing(hostId),
        };
    }

    //Private variables
    private lastCPUTimes: CPUTimes;
    private lastDiskStats: DiskStat;
    private lastNetworkStats: NetworkStat;

    //Private methods
    private async ComputeCPUUsage(hostId: number)
    {
        const times = await this.QueryCPUTimesSinceBootTimeUntilNow(hostId);

        const idle_delta = times.idle - this.lastCPUTimes.idle;
        const total_delta = times.sum - this.lastCPUTimes.sum;

        this.lastCPUTimes = times;

        return 100 * (1 - (idle_delta / total_delta));
    }

    private async ExecutePing(hostId: number)
    {
        const t1 = Date.now();
        await this.remoteCommandExecutor.ExecuteCommand(["echo", "ping"], hostId);
        const t2 = Date.now();

        return t2 - t1;
    }

    private async QueryCPUTimesSinceBootTimeUntilNow(hostId: number): Promise<CPUTimes>
    {
        const data = await this.remoteFileSystemManager.ReadTextFile(hostId, "/proc/stat");
        const line = data.split("\n")[0].trim();
        const parts = line.split(" ");
        parts.Remove(0); //remove the "cpu"
        while(parts[0].trim().length === 0)
            parts.Remove(0); //remove the "cpu " space
        const numbers = parts.map(x => parseInt(x));

        return {
            idle: numbers[3],
            sum: numbers.reduce( (acc, a) => acc + a )
        };
    }

    private async QueryDiskUsage(hostId: number)
    {
        const stats = await this.ReadDiskStats(hostId);

        const sectorsReadCount = stats.Values().Map(x => x.sectorsReadCount).Sum();
        const sectorsWriteCount = stats.Values().Map(x => x.sectorsWriteCount).Sum();

        const delta_read = sectorsReadCount - this.lastDiskStats.sectorsReadCount;
        const delta_write = sectorsWriteCount - this.lastDiskStats.sectorsWriteCount;

        this.lastDiskStats.sectorsReadCount = sectorsReadCount;
        this.lastDiskStats.sectorsWriteCount = sectorsWriteCount;

        return {
            currentBytesRead: delta_read,
            currentBytesWritten: delta_write
        };
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

    private async QueryNetworkUsage(hostId: number)
    {
        const stats = await this.hostMetricsService.ReadNetworkStatistics(hostId);

        const bytesReadCount = stats.Values().Map(x => x.bytesReadCount).Sum();
        const bytesWrittenCount = stats.Values().Map(x => x.bytesTransmittedCount).Sum();

        const delta_read = bytesReadCount - this.lastNetworkStats.bytesReadCount;
        const delta_write = bytesWrittenCount - this.lastNetworkStats.bytesTransmittedCount;

        this.lastNetworkStats.bytesReadCount = bytesReadCount;
        this.lastNetworkStats.bytesTransmittedCount = bytesWrittenCount;

        return {
            currentBytesRead: delta_read,
            currentBytesWritten: delta_write
        };
    }

    private async ReadDiskStats(hostId: number)
    {
        const data = await this.remoteFileSystemManager.ReadTextFile(hostId, "/proc/diskstats");
        const lines = data.trimEnd().split("\n");

        const result: DiskStat[] = [];
        for (const line of lines)
        {
            const parts = line.trim().split(/[ \t]+/);

            result.push({
                deviceName: parts[2],
                sectorsReadCount: parseInt(parts[5]),
                sectorsWriteCount: parseInt(parts[9]),
                currentlyInProgress: parseInt(parts[11])
            });
        }

        return result;
    }
}