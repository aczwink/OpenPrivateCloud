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
import { RemoteCommandExecutor } from "../../services/RemoteCommandExecutor";
import { VirtualMachineProperties } from "./Properties";

export interface OSInfo
{
    type: "ubuntu" | "ubuntu-server";
    id: string;
    version: number;
    versionString: string;
}

@Injectable
export class OSQueryService
{
    constructor(private remoteCommandExecutor: RemoteCommandExecutor)
    {
    }

    //Public methods
    public async FindOSInfo(hostId: number, instanceProperties: VirtualMachineProperties): Promise<OSInfo>
    {
        const entries = await this.FetchOSEntries(hostId, instanceProperties);

        switch(instanceProperties.os)
        {
            case "ubuntu-lts-latest":
            case "ubuntu-server-lts-latest":
            {
                const entry = entries.Values().Filter(x => x.osId.startsWith("ubuntu") && x.osName.includes("LTS")).OrderByDescending(x => x.osVersion).First();
                return {
                    type: instanceProperties.os === "ubuntu-lts-latest" ? "ubuntu" : "ubuntu-server",
                    id: entry.osId,
                    version: entry.osVersion,
                    versionString: entry.osVersionString,
                };
            }
            case "ubuntu-latest":
            case "ubuntu-server-latest":
                const entry = entries.Values().Filter(x => x.osId.startsWith("ubuntu") && x.releaseDate !== undefined).OrderByDescending(x => x.osVersion).First();
                return {
                    type: instanceProperties.os === "ubuntu-latest" ? "ubuntu" : "ubuntu-server",
                    id: entry.osId,
                    version: entry.osVersion,
                    versionString: entry.osVersionString,
                };
        }
    }

    //Private methods
    private async FetchOSEntries(hostId: number, instanceProperties: VirtualMachineProperties)
    {
        const vendor = this.MapOSTypeToVendor(instanceProperties);
        const { stdOut } = await this.remoteCommandExecutor.ExecuteBufferedCommand(["osinfo-query", "--fields=short-id,name,version,release-date", "os", 'vendor=' + vendor], hostId);
        const lines = stdOut.trimEnd().split("\n");
        return lines.slice(2).map(x => {
            const parts = x.split("|");
            const rd = new Date(parts[3].trim());
            return {
                osId: parts[0].trim(),
                osName: parts[1].trim(),
                osVersion: parseFloat(parts[2].trim()),
                osVersionString: parts[2].trim(),
                releaseDate: (isNaN(rd.valueOf()) ? undefined : rd)
            };
        });
    }

    private MapOSTypeToVendor(instanceProperties: VirtualMachineProperties)
    {
        switch(instanceProperties.os)
        {
            case "ubuntu-lts-latest":
            case "ubuntu-server-lts-latest":
            case "ubuntu-latest":
            case "ubuntu-server-latest":
                return "Canonical Ltd";
        }
    }
}