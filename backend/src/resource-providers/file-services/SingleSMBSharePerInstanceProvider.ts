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
import { permissions } from "openprivatecloud-common";
import { InstanceContext } from "../../common/InstanceContext";
import { HostsController } from "../../data-access/HostsController";
import { PermissionsController } from "../../data-access/PermissionsController";
import { HostUsersManager } from "../../services/HostUsersManager";
import { SambaSharesManager } from "./SambaSharesManager";

interface SMBShareConfig
{
    enabled: boolean;
    sharePath: string;
    readOnly: boolean;
}

@Injectable
export class SingleSMBSharePerInstanceProvider
{
    constructor(private hostsController: HostsController, private hostUsersManager: HostUsersManager, private sambaSharesManager: SambaSharesManager,
        private permissionsController: PermissionsController)
    {
    }
    
    public async GetSMBConnectionInfo(instanceContext: InstanceContext, userId: number)
    {
        const host = await this.hostsController.RequestHostCredentials(instanceContext.hostId);
        const userName = this.hostUsersManager.MapUserToLinuxUserName(userId);
        
        return this.sambaSharesManager.GetConnectionInfo(host!.hostName, this.MapFullInstanceNameToSMBShareName(instanceContext.fullInstanceName), userName);
    }

    public async UpdateSMBConfig(shareConfig: SMBShareConfig, instanceContext: InstanceContext)
    {
        const hostId = instanceContext.hostId;
        const fullInstanceName = instanceContext.fullInstanceName;

        const readGroups = await this.permissionsController.QueryGroupsWithPermission(instanceContext.instanceId, permissions.data.read);
        const readGroupsLinux = readGroups.Map(x => "+" + this.hostUsersManager.MapGroupToLinuxGroupName(x)).ToArray();

        const shareName = this.MapFullInstanceNameToSMBShareName(fullInstanceName);

        if(shareConfig.enabled && (readGroupsLinux.length === 0))
        {
            await this.DeleteShareIfExisting(hostId, shareName);
            return "ErrorNoOneHasAccess"; //when the "valid users" property in samba is empty, every user has access
        }
        
        if(shareConfig.enabled)
        {
            await this.hostUsersManager.SyncSambaGroupsMembers(hostId, readGroups.ToArray());

            let writeGroupsLinux: string[] = [];
            if(!shareConfig.readOnly)
            {
                const writeGroups = await this.permissionsController.QueryGroupsWithPermission(instanceContext.instanceId, permissions.data.write);
                await this.hostUsersManager.SyncSambaGroupsMembers(hostId, writeGroups.ToArray());
                writeGroupsLinux = writeGroups.Map(x => "+" + this.hostUsersManager.MapGroupToLinuxGroupName(x)).ToArray();
            }

            await this.sambaSharesManager.SetShare(hostId, {
                readUsers: readGroupsLinux,
                writeUsers: writeGroupsLinux,
                shareName,
                sharePath: shareConfig.sharePath
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

    private MapFullInstanceNameToSMBShareName(fullInstanceName: string)
    {
        return fullInstanceName.substring(1).ReplaceAll("/", "_");
    }
}