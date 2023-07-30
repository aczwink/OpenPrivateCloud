/**
 * OpenPrivateCloud
 * Copyright (C) 2023 Amir Czwink (amir130@hotmail.de)
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
import { HostMetricsService } from "./HostMetricsService";

@Injectable
export class HostNetworkInterfaceCardsManager
{
    constructor(private hostMetricsService: HostMetricsService)
    {
    }

    //Public methods
    public async FindExternalNetworkInterface(hostId: number)
    {
        const stats = await this.hostMetricsService.ReadNetworkStatistics(hostId);
        const filtered = stats.filter(x => x.interfaceName.startsWith("en"));
        if(filtered.length != 1)
            throw new Error("Method not implemented.");
        return filtered[0].interfaceName;
    }

    public async QueryAllNetworkInterfaces(hostId: number)
    {
        const stats = await this.hostMetricsService.ReadNetworkStatistics(hostId);
        return stats.map(x => x.interfaceName);
    }
}