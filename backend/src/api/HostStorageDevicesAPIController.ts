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
import { APIController, Common, Get, NotFound, Path, Query } from "acts-util-apilib";
import { HostsController } from "../data-access/HostsController";
import { HostStorageDevicesManager } from "../services/HostStorageDevicesManager";

interface StorageDeviceDto
{
    devicePath: string;
    name: string;
}
 
@APIController("hosts/{hostName}/storageDevices")
class HostStorageDevicesAPIController
{
    constructor(private hostsController: HostsController, private hostStorageDevicesManager: HostStorageDevicesManager)
    {
    }

    @Common()
    public async QueryHost(
        @Path hostName: string
    )
    {
        const hostId = await this.hostsController.RequestHostId(hostName);
        if(hostId === undefined)
            return NotFound("host does not exist");
        return hostId;
    }

    @Get("partitions")
    public async QueryPartitions(
        @Common hostId: number,
        @Query devicePath: string
    )
    {
        const sds = await this.hostStorageDevicesManager.QueryStorageDevices(hostId);
        const device = sds.find(x => x.path === devicePath);
        if(device === undefined)
            return NotFound("device does not exist");
        return device.partitions;
    }
    
    @Get("smart")
    public async QuerySMARTInfo(
        @Common hostId: number,
        @Query devicePath: string
    )
    {
        return await this.hostStorageDevicesManager.QuerySMARTInfo(hostId, devicePath);
    }
    
    @Get()
    public async QueryStorageDevices(
        @Common hostId: number
    )
    {
        const sds = await this.hostStorageDevicesManager.QueryStorageDevices(hostId);
        return sds.map(x => {
            const res: StorageDeviceDto = {
                name: x.vendor + " " + x.model,
                devicePath: x.path
            }
            return res;
        });
    }
}