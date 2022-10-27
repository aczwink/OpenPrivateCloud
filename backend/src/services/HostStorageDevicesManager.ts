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
import { RemoteCommandExecutor } from "./RemoteCommandExecutor";

interface Partition
{
    path: string;
    mountPoint: string;
}

interface StorageDevice
{
    vendor: string;
    model: string;
    path: string;

    partitions: Partition[];
}

@Injectable
export class HostStorageDevicesManager
{
    constructor(private remoteCommandExecutor: RemoteCommandExecutor)
    {
    }

    //Public methods
    public async QueryStorageDevices(hostId: number): Promise<StorageDevice[]>
    {
        const json = await this.QueryData(hostId);
        
        return json.blockdevices.Values()
            .Filter( (x: any) => !x.name.startsWith("/dev/loop"))
            .Map(this.MapDevice.bind(this))
            .ToArray();
    }

    //Private methods
    private MapChildren(children: any): Partition[]
    {
        if(children === undefined)
            return [];
        return (children as any[]).Values().Map(x => this.MapPartition(x).Values()).Flatten().ToArray();
    }

    private MapDevice(devInfo: any): StorageDevice
    {
        return {
            vendor: devInfo.vendor,
            model: devInfo.model,
            path: devInfo.name,
            partitions: this.MapChildren(devInfo.children)
        };
    }

    private MapPartition(partInfo: any): Partition[]
    {
        const part = {
            path: partInfo.name,
            mountPoint: partInfo.mountpoint
        };

        return [part, ...this.MapChildren(partInfo.children)];
    }

    private async QueryData(hostId: number)
    {
        const { stdOut } = await this.remoteCommandExecutor.ExecuteBufferedCommand(["lsblk", "-bJOp"], hostId);
        return JSON.parse(stdOut);
    }
}