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
import { HealthController, HealthStatus } from "../data-access/HealthController";
import { HostsController } from "../data-access/HostsController";
import { ResourcesController } from "../data-access/ResourcesController";
import { ModulesManager } from "./ModulesManager";
import { RemoteConnectionsManager } from "./RemoteConnectionsManager";
import { ResourceHealthManager } from "./ResourceHealthManager";
import { ErrorService } from "./ErrorService";
import { NumberDictionary } from "acts-util-core";
import { HostUpdateManager } from "./HostUpdateManager";
import { HostStorageDevicesManager, SMART_Result } from "./HostStorageDevicesManager";
import { opcSpecialUsers, opcSpecialGroups } from "../common/UserAndGroupDefinitions";
import { RemoteFileSystemManager } from "./RemoteFileSystemManager";
import { RemoteRootFileSystemManager } from "./RemoteRootFileSystemManager";

 
@Injectable
export class HostAvailabilityManager
{
    constructor(private modulesManager: ModulesManager, private hostsController: HostsController, private instancesController: ResourcesController, private healthController: HealthController,
        private remoteConnectionsManager: RemoteConnectionsManager, private errorService: ErrorService, private hostUpdateManager: HostUpdateManager, private remoteFileSystemManager: RemoteFileSystemManager,
        private resourceHealthManager: ResourceHealthManager, private hostStorageDevicesManager: HostStorageDevicesManager, private remoteRootFileSystemManager: RemoteRootFileSystemManager)
    {
    }

    //Public methods
    public async CheckHostsHealth()
    {
        const hostIds = await this.hostsController.RequestHostIds();
        for (const hostId of hostIds)
        {
            try
            {
                await this.CheckHostHealth(hostId);
            }
            catch(e)
            {
                await this.UpdateHostHealth(hostId, HealthStatus.Down, e);
            }
        }
    }

    public async CheckResourcesAvailability()
    {
        const hostIds = await this.hostsController.RequestHostIds();

        const available: NumberDictionary<boolean> = {};
        for (const hostId of hostIds)
            available[hostId] = await this.CheckHostAvailability(hostId);
        for (const hostId of hostIds)
        {
            const resourceIds = await this.instancesController.QueryResourceIdsAssociatedWithHost(hostId);
            if(available[hostId])
            {
                for (const resourceId of resourceIds)
                    await this.resourceHealthManager.CheckResourceAvailability(resourceId);
            }
            else
            {
                for (const resourceId of resourceIds)
                    await this.resourceHealthManager.UpdateResourceAvailability(resourceId, HealthStatus.Down, "host is not available");
            }
        }
    }

    public async EnsureHostIsConfiguredAppropriatly(hostId: number)
    {
        await this.modulesManager.EnsureModuleIsInstalled(hostId, "core");

        const storages = await this.hostsController.RequestHostStorages(hostId);
        for (const storage of storages)
        {
            const fp = await this.IsStoragePathOwnershipCorrect(hostId, storage.path);
            if(!fp)
                await this.remoteRootFileSystemManager.ChangeOwnerAndGroup(hostId, storage.path, opcSpecialUsers.host.uid, opcSpecialGroups.host.gid);
        }
    }

    //Private methods
    private async CheckHostAvailability(hostId: number)
    {
        try
        {
            const conn = await this.remoteConnectionsManager.AcquireConnection(hostId);
            conn.Release();
        }
        catch(e)
        {
            await this.UpdateHostHealth(hostId, HealthStatus.Down, e);
            return false;
        }
        await this.UpdateHostHealth(hostId, HealthStatus.Up);
        return true;
    }

    private async CheckHostHealth(hostId: number)
    {
        await this.EnsureHostIsConfiguredAppropriatly(hostId);

        const updateInfo = await this.hostUpdateManager.QueryUpdateInfo(hostId);
        if(updateInfo.updatablePackagesCount > 10)
        {
            await this.UpdateHostHealth(hostId, HealthStatus.Corrupt, "host hasn't been updated in a while");
            return;
        }
        else
        {
            const storageDevices = await this.hostStorageDevicesManager.QueryStorageDevices(hostId);
            for (const storageDevice of storageDevices)
            {
                const smart = await this.hostStorageDevicesManager.QuerySMARTInfo(hostId, storageDevice.path);
                if(!this.VerifySMARTData(smart))
                {
                    await this.UpdateHostHealth(hostId, HealthStatus.Corrupt, "storage device problem");
                    return;
                }
            }
        }

        await this.UpdateHostHealth(hostId, HealthStatus.Up);
    }

    private async IsStoragePathOwnershipCorrect(hostId: number, storagePath: string)
    {
        const stat = await this.remoteFileSystemManager.QueryStatus(hostId, storagePath)
        return (stat.uid === opcSpecialUsers.host.uid) && (stat.gid === opcSpecialGroups.host.gid);
    }

    private VerifySMARTData(smartData: SMART_Result)
    {
        if(smartData.smartctl.exit_status != 0)
            return false;
        for (const attr of smartData.ata_smart_attributes.table)
        {
            switch(attr.id)
            {
                case 5: //Reallocated Sectors Count
                case 10: //Spin Retry Count
                case 187: //Reported Uncorrectable Errors
                case 196: //Reallocation Event Count
                case 197: //Current Pending Sector Count
                case 198: //(Offline) Uncorrectable Sector Count
                    if(attr.raw.value !== 0)
                        return false;
                    break;
                case 184: //End-to-End error / IOEDC
                    throw new Error("184 NOT IMPLEMENTED");
                case 188: //Command Timeout
                    throw new Error("188 NOT IMPLEMENTED");
                case 201: //Soft Read Error Rate / TA Counter Detected
                    throw new Error("201 NOT IMPLEMENTED");
            }
        }
        return true;
    }

    private async UpdateHostHealth(hostId: number, status: HealthStatus, logData?: unknown)
    {
        const log = this.errorService.ExtractDataAsMultipleLines(logData);
        await this.healthController.UpdateHostHealth(hostId, status, log);
    }
}