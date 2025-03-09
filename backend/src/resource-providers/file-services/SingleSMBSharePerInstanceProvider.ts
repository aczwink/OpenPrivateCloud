/**
 * OpenPrivateCloud
 * Copyright (C) 2019-2025 Amir Czwink (amir130@hotmail.de)
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
import { permissions } from "openprivatecloud-common";
import { HostsController } from "../../data-access/HostsController";
import { HostUsersManager } from "../../services/HostUsersManager";
import { SambaSharesManager } from "./SambaSharesManager";
import { ResourceReference } from "../../common/ResourceReference";
import { PermissionsManager } from "../../services/PermissionsManager";

interface SMBShareConfig
{
    enabled: boolean;
    sharePath: string;
    readOnly: boolean;
    transportEncryption: boolean;
}

@Injectable
export class SingleSMBSharePerInstanceProvider
{
    constructor(private hostsController: HostsController, private hostUsersManager: HostUsersManager, private sambaSharesManager: SambaSharesManager,
        private permissionsManager: PermissionsManager)
    {
    }

    //Public methods
    public async ClearShareIfExisting(hostId: number, oldExternalResourceId: string)
    {
        const shareName = this.MapExternalIdToSMBShareName(oldExternalResourceId);
        await this.DeleteShareIfExisting(hostId, shareName);
    }
    
    public async GetSMBConnectionInfo(resourceReference: ResourceReference, opcUserId: number)
    {
        const host = await this.hostsController.QueryHost(resourceReference.hostId);
        const userName = this.hostUsersManager.MapUserToLinuxUserName(opcUserId);
        
        return this.sambaSharesManager.GetConnectionInfo(host!.hostName, this.MapExternalIdToSMBShareName(resourceReference.externalId), userName);
    }

    public async IsShareOnline(resourceReference: ResourceReference)
    {
        const served = await this.sambaSharesManager.RequestServedShares(resourceReference.hostId);
        const shareName = this.MapExternalIdToSMBShareName(resourceReference.externalId);

        return served.includes(shareName);
    }

    public async UpdateSMBConfig(shareConfig: SMBShareConfig, resourceReference: ResourceReference)
    {
        const hostId = resourceReference.hostId;

        const readGroups = await this.permissionsManager.QueryGroupsWithPermission(resourceReference.id, permissions.data.read);
        const readGroupsLinux = readGroups.Map(x => "+" + this.hostUsersManager.MapGroupToLinuxGroupName(x)).ToArray();

        const shareName = this.MapExternalIdToSMBShareName(resourceReference.externalId);

        if(shareConfig.enabled && (readGroupsLinux.length === 0))
        {
            await this.DeleteShareIfExisting(hostId, shareName);
            return "ErrorNoOneHasAccess"; //when the "valid users" property in samba is empty, every user has access
        }
        
        if(shareConfig.enabled)
        {
            const readGroupsArray = readGroups.ToArray();
            await this.hostUsersManager.SyncGroupsToHost(hostId, readGroupsArray);
            await this.hostUsersManager.SyncSambaGroupsMembers(hostId, readGroupsArray);

            let writeGroupsLinux: string[] = [];
            if(!shareConfig.readOnly)
            {
                const writeGroups = await this.permissionsManager.QueryGroupsWithPermission(resourceReference.id, permissions.data.write);
                const writeGroupsArray = writeGroups.ToArray();
                await this.hostUsersManager.SyncGroupsToHost(hostId, writeGroupsArray);
                await this.hostUsersManager.SyncSambaGroupsMembers(hostId, writeGroupsArray);
                writeGroupsLinux = writeGroups.Map(x => "+" + this.hostUsersManager.MapGroupToLinuxGroupName(x)).ToArray();
            }

            await this.sambaSharesManager.SetShare(hostId, {
                readUsers: readGroupsLinux,
                writeUsers: writeGroupsLinux,
                shareName,
                sharePath: shareConfig.sharePath,
                smbEncrypt: shareConfig.transportEncryption ? "required" : "default"
            });
        }
        else
            await this.DeleteShareIfExisting(hostId, shareName);
    }

    //Private methods
    private async DeleteShareIfExisting(hostId: number, shareName: string)
    {
        const share = await this.sambaSharesManager.QueryShareSettings(hostId, shareName);
        if(share !== undefined)
            await this.sambaSharesManager.DeleteShare(hostId, shareName);
    }

    private MapExternalIdToSMBShareName(externalId: string)
    {
        return externalId.substring(1).ReplaceAll("/", "_");
    }
}