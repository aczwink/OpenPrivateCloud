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
            case "ubuntu-latest":
            case "ubuntu-server-latest":
                const entry = entries.Values().Filter(x => x.osId.startsWith("ubuntu")).OrderByDescending(x => x.osVersion).First();
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
        const { stdOut } = await this.remoteCommandExecutor.ExecuteBufferedCommand(["osinfo-query", "--fields=short-id,version", "os", 'vendor="' + vendor + '"'], hostId);
        const lines = stdOut.trimEnd().split("\n");
        return lines.slice(2).map(x => {
            const parts = x.split("|");
            return {
                osId: parts[0].trim(),
                osVersion: parseFloat(parts[1].trim()),
                osVersionString: parts[1].trim()
            };
        });
    }

    private MapOSTypeToVendor(instanceProperties: VirtualMachineProperties)
    {
        switch(instanceProperties.os)
        {
            case "ubuntu-latest":
            case "ubuntu-server-latest":
                return "Canonical Ltd";
        }
    }
}