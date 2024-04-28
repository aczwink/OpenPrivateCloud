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
import { GlobalInjector } from "acts-util-node";
import { DataSourceQueryResult, DataSourceCollectionProvider, DataSourceProvider, DataSourcesProvider, SourceQueryOptions } from "../ClusterDataProvider";
import { RemoteCommandExecutor } from "../RemoteCommandExecutor";
import { Dictionary } from "acts-util-core";

export class HostSysLogBootDataProvider implements DataSourceProvider
{
    constructor(private hostId: number, private filterArgs: string[])
    {
    }

    //Public methods
    public async QuerySourceData(queryOptions: SourceQueryOptions): Promise<DataSourceQueryResult>
    {
        const data = await this.QuerySysLog(queryOptions);

        return {
            keys: {
                __REALTIME_TIMESTAMP: {
                    dataType: "number",
                    title: "Timestamp",
                    format: "date-time-us"
                },
                MESSAGE: {
                    dataType: "string"
                },
                PRIORITY: {
                    dataType: "number",
                    valueMapping: {
                        2: "critical",
                        3: "error",
                        6: "info"
                    }
                }
            },
            values: data.Values()
        };
    }

    //Private methods
    private async QuerySysLog(queryOptions: SourceQueryOptions)
    {
        function PadNumber(x: number, length: number)
        {
            let str = x.toString();
            while(str.length < length)
                str = "0" + str;
            return str;
        }

        function FormatDate(timestamp: number)
        {
            //"--since" and "--until" always want local time
            const dt = new Date(timestamp);
            const str = dt.getFullYear() + "-" + PadNumber(dt.getMonth()+1, 2) + "-" + PadNumber(dt.getDate(), 2) + " " + PadNumber(dt.getHours(), 2) + ":" + PadNumber(dt.getMinutes(), 2);
            return str;
        }

        const remoteCommandExecutor = GlobalInjector.Resolve(RemoteCommandExecutor);

        const fields = ["__REALTIME_TIMESTAMP", "MESSAGE", "PRIORITY"];
        const result = await remoteCommandExecutor.ExecuteBufferedCommand([
            "sudo", "journalctl",
            ...this.filterArgs,
            "--utc",
            "--no-pager",
            "-o", "json",
            "--output-fields=" + fields.join(","),
            "-n", queryOptions.maxRecordCount.toString(),
            "--since", FormatDate(queryOptions.startTime),
            "--until", FormatDate(queryOptions.endTime),
        ], this.hostId);
        const data = result.stdOut.trimEnd();
        if(data.length === 0)
            return [];
        return data.split("\n").map(x => JSON.parse(x));
    }
}

export class HostSysLogPastBootLogsDataProvider implements DataSourceCollectionProvider
{
    constructor(private hostId: number)
    {
    }

    //Public methods
    public async QueryChildren(): Promise<Dictionary<DataSourcesProvider>>
    {
        const remoteCommandExecutor = GlobalInjector.Resolve(RemoteCommandExecutor);

        const data = await remoteCommandExecutor.ExecuteBufferedCommand(["sudo", "journalctl", "--list-boots", "-o", "json"], this.hostId);
        const entries = JSON.parse(data.stdOut) as any[];

        return entries.Values().ToDictionary(x => x.boot_id, x => new HostSysLogBootDataProvider(this.hostId, ["-b", x.boot_id]) );
    }
}

export class HostSysLogDataProvider implements DataSourceCollectionProvider
{
    constructor(private hostId: number)
    {
    }

    //Public methods
    public async QueryChildren(): Promise<Dictionary<DataSourcesProvider>>
    {
        return {
            boot: new HostSysLogBootDataProvider(this.hostId, ["-b", "0"]),
            boots: new HostSysLogPastBootLogsDataProvider(this.hostId),
            lastBoot: new HostSysLogBootDataProvider(this.hostId, ["-b", "-1"]),
        };
    }
}