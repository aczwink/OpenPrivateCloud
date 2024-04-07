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

import { Dictionary } from "acts-util-core";
import { Injectable } from "acts-util-node";
import { RemoteCommandExecutor } from "./RemoteCommandExecutor";
import { MountsManager } from "./MountsManager";

interface Partition
{
    path: string;
    mountPoint: string | null;
    uuid: string;
}

export interface SMART_Attribute
{
    id: number;
    name: string;
    value: number;
    worst: number;
    thresh: number;

    raw: {
        value: number;
    };
}

interface ATA_SMART_Info
{
    ata_smart_attributes: {
        table: SMART_Attribute[];
    };

    ata_smart_data: {
        self_test: {
            polling_minutes: Dictionary<number>;
        };
    };

    ata_smart_error_log: {
        summary: {
            count: number;
        };
    };

    ata_smart_self_test_log: {
        standard: {
            count: number;
        };
    };
}

interface SMART_Message
{
    string: string;
    severity: string;
}

export interface SMART_Result extends ATA_SMART_Info
{
    smartctl: {
        messages?: SMART_Message[];
        exit_status: number;
    };
}

interface StorageDevice
{
    /**
     * true if the device can be removed while the pc is running
     */
    hotplug: boolean;
    model: string;
    path: string;
    /**
     * Removable media like optical disc
     */
    rm: boolean;
    /**
     * "usb" for USB devices
     */
    tran: string | null;
    vendor: string;

    partitions: Partition[];
}

@Injectable
export class HostStorageDevicesManager
{
    constructor(private remoteCommandExecutor: RemoteCommandExecutor, private mountsManager: MountsManager)
    {
    }

    //Public methods
    public async UnmountAndPowerOffDevice(hostId: number, devicePath: string)
    {
        const devices = await this.QueryStorageDevices(hostId);
        const device = devices.find(x => x.path === devicePath);

        if(device === undefined)
            return;

        for (const partition of device.partitions)
        {
            if(partition.mountPoint !== null)
                await this.mountsManager.UnmountAndRemoveMountPointIfStandard(hostId, partition.path);
        }

        await this.remoteCommandExecutor.ExecuteCommand(["sudo", "udisksctl", "power-off", "-b", devicePath], hostId);
    }

    public async QuerySMARTInfo(hostId: number, devicePath: string)
    {
        const { stdOut } = await this.remoteCommandExecutor.ExecuteBufferedCommandWithExitCode(["sudo", "smartctl", "-a", devicePath, "-j"], hostId);
        return JSON.parse(stdOut) as SMART_Result;
    }

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
            hotplug: devInfo.hotplug,
            model: devInfo.model,
            vendor: devInfo.vendor,
            path: devInfo.name,
            rm: devInfo.rm,
            tran: devInfo.tran,
            partitions: this.MapChildren(devInfo.children)
        };
    }

    private MapPartition(partInfo: any): Partition[]
    {
        const part: Partition = {
            path: partInfo.name,
            mountPoint: partInfo.mountpoint,
            uuid: partInfo.uuid,
        };

        return [part, ...this.MapChildren(partInfo.children)];
    }

    private async QueryData(hostId: number)
    {
        const { stdOut } = await this.remoteCommandExecutor.ExecuteBufferedCommand(["lsblk", "-bJOp"], hostId);
        return JSON.parse(stdOut);
    }
}