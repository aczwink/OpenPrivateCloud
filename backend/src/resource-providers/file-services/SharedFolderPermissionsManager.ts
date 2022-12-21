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
import { PermissionsController } from "../../data-access/PermissionsController";
import { HostUsersManager } from "../../services/HostUsersManager";
import { RemoteCommandExecutor } from "../../services/RemoteCommandExecutor";

@Injectable
export class SharedFolderPermissionsManager
{
    constructor(private permissionsController: PermissionsController, private hostUsersManager: HostUsersManager, private remoteCommandExecutor: RemoteCommandExecutor)
    {
    }

    //Public methods
    public async SetPermissions(instanceContext: InstanceContext, dirPath: string, readOnly: boolean)
    {
        const acl = ["u::rwX", "g::rwX", "o::-"];

        const readGroups = await this.permissionsController.QueryGroupsWithPermission(instanceContext.instanceId, permissions.data.read);
        const readLinuxGroups = readGroups.Map(x => this.hostUsersManager.MapGroupToLinuxGroupName(x)).ToArray();

        for (const readLinuxGroup of readLinuxGroups)
            acl.push("g:" + readLinuxGroup + ":rX");

        if(!readOnly)
        {
            const writeGroups = await this.permissionsController.QueryGroupsWithPermission(instanceContext.instanceId, permissions.data.write);
            const writeLinuxGroups = writeGroups.Map(x => this.hostUsersManager.MapGroupToLinuxGroupName(x)).ToArray();

            for (const writeLinuxGroup of writeLinuxGroups)
                acl.push("g:" + writeLinuxGroup + ":rwX");
        }

        const aclString = acl.join(",");

        //TODO: without the "-R" and without the default acl every user can only edit his own files inside the share. Maybe this is desired some day
        await this.remoteCommandExecutor.ExecuteCommand(["sudo", "setfacl", "-R", "--set", aclString, dirPath], instanceContext.hostId);
        await this.remoteCommandExecutor.ExecuteCommand(["sudo", "setfacl", "-R", "-d", "--set", aclString, dirPath], instanceContext.hostId);
    }
}