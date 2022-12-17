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
import { InstanceContext } from "../../common/InstanceContext";
import { opcSpecialGroups } from "../../common/UserAndGroupDefinitions";
import { PermissionsController } from "../../data-access/PermissionsController";
import { HostUsersManager } from "../../services/HostUsersManager";
import { RemoteFileSystemManager } from "../../services/RemoteFileSystemManager";
import { RemoteRootFileSystemManager } from "../../services/RemoteRootFileSystemManager";

@Injectable
export class SharedFolderPermissionsManager
{
    constructor(private permissionsController: PermissionsController, private hostUsersManager: HostUsersManager,
        private remoteRootFileSystemManager: RemoteRootFileSystemManager, private remoteFileSystemManager: RemoteFileSystemManager)
    {
    }

    //Public methods
    public async SetPermissions(instanceContext: InstanceContext, dirPath: string, readOnly: boolean, permissions: string[])
    {
        const groups = await this.permissionsController.QueryGroupsWithPermission(instanceContext.instanceId, permissions);
        const linuxGroups = groups.Map(x => this.hostUsersManager.MapGroupToLinuxGroupName(x)).ToArray();

        const primaryLinuxGroupName = (linuxGroups.length > 0) ? linuxGroups.shift()! : opcSpecialGroups.host;
        const gid = await this.hostUsersManager.ResolveHostGroupId(instanceContext.hostId, primaryLinuxGroupName);

        await this.SetPermissionsInternal(instanceContext.hostId, dirPath, readOnly, gid, linuxGroups);
    }

    //Private methods
    private async SetPermissionsInternal(hostId: number, filePath: string, readOnly: boolean, primaryGid: number, supplementalLinuxGroups: string[])
    {
        const stats = await this.remoteFileSystemManager.QueryStatus(hostId, filePath);

        await this.remoteRootFileSystemManager.ChangeOwnerAndGroup(hostId, filePath, stats.uid, primaryGid);

        const mode = readOnly ? 0o750 : 0o770;
        await this.remoteRootFileSystemManager.ChangeMode(hostId, filePath, mode);

        //TODO: recursive?
        //TODO: set supplemental groups with ACLs?
    }
}