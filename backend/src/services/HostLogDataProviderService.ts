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
import { RemoteCommandExecutor } from "./RemoteCommandExecutor";
import { ClusterDataProvider, DataSourceQueryResult, DataSourcesProvider } from "./ClusterDataProvider";
import { HostsController } from "../data-access/HostsController";

interface JournalEntry
{
    MESSAGE: string;
    PRIORITY: string;
    SYSLOG_TIMESTAMP: string;
}

@Injectable
export class HostLogDataProviderService implements DataSourcesProvider
{
    constructor(private remoteCommandExecutor: RemoteCommandExecutor, private hostsController: HostsController, private clusterDataProvider: ClusterDataProvider)
    {
    }

    //Properties
    public get rootNameSpace()
    {
        return "hosts";
    }

    //Public methods
    public async QuerySourceData(name: string): Promise<DataSourceQueryResult>
    {
        const parts = name.split(".");
        const hostId = await this.hostsController.RequestHostId(parts[1]);

        const data = await this.QuerySysLog(hostId!);

        return {
            keys: this.clusterDataProvider.BuildSchemaFromObject(data[0]),
            values: data.Values()
        };
    }

    public async QuerySources(): Promise<string[]>
    {
        const hosts = await this.hostsController.RequestHosts();
        return hosts.map(h => "hosts." + h.hostName + ".syslog");
    }

    //Private methods
    private async QuerySysLog(hostId: number)
    {
        const result = await this.remoteCommandExecutor.ExecuteBufferedCommand(["sudo", "journalctl", "--utc", "--no-pager", "-o", "json", "-n", "1000"], hostId);
        return result.stdOut.trimEnd().split("\n").map(x => JSON.parse(x) as JournalEntry);
    }
}