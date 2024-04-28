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
import { DataSourceCollectionProvider, DataSourcesProvider } from "../ClusterDataProvider";
import { HostsController } from "../../data-access/HostsController";
import { HostSysLogDataProvider } from "./HostLogDataProviderService";
import { Dictionary } from "acts-util-core";

export class HostDataProvider implements DataSourceCollectionProvider
{
    constructor(private hostId: number)
    {
    }

    public async QueryChildren(): Promise<Dictionary<DataSourcesProvider>>
    {
        return {
            syslog: new HostSysLogDataProvider(this.hostId)
        };
    }
}

@Injectable
export class HostsDataProvider implements DataSourceCollectionProvider
{
    constructor(private hostsController: HostsController)
    {
    }

    public async QueryChildren(): Promise<Dictionary<DataSourcesProvider>>
    {
        const hosts = await this.hostsController.RequestHostIdsAndNames();
        return hosts.Values().ToDictionary(h => h.hostName, h => new HostDataProvider(h.id) );
    }
}