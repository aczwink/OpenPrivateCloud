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
import { opcGroupPrefixes, opcSpecialGroups, opcUserPrefixes } from "../common/UserAndGroupDefinitions";
import { PermissionsController } from "../data-access/PermissionsController";
import { UsersController } from "../data-access/UsersController";
import { RemoteCommandExecutor } from "./RemoteCommandExecutor";
import { LinuxUsersManager } from "./LinuxUsersManager";

interface SambaUser
{
    unixUserName: string;
    enabled: boolean;
}
 
@Injectable
export class HostUsersManager
{
    constructor(private remoteCommandExecutor: RemoteCommandExecutor, private usersController: UsersController, private linuxUsersManager: LinuxUsersManager, private permissionsController: PermissionsController)
    {
    }

    //Public methods
    public MapGroupToLinuxGroupName(userGroupId: number)
    {
        return opcGroupPrefixes.group + userGroupId;
    }

    public async MapHostUserIdToLinuxUserName(hostId: number, hostUserId: number)
    {
        const result = await this.remoteCommandExecutor.ExecuteBufferedCommand(["id", "-nu", hostUserId.toString()], hostId);
        return result.stdOut.trim();
    }

    public MapLinuxUserNameToUserId(linuxUserName: string)
    {
        const idPart = linuxUserName.substring(opcUserPrefixes.user.length);
        return parseInt(idPart);
    }

    public MapUserToLinuxUserName(userId: number)
    {
        return opcUserPrefixes.user + userId;
    }

    public async RemoveGroupFromHost(hostId: number, userGroupId: number)
    {
        const linuxGroupName = this.MapGroupToLinuxGroupName(userGroupId);
        await this.DeleteHostGroup(hostId, linuxGroupName);

        const members = await this.usersController.QueryMembersOfGroup(userGroupId);
        const userIds = await this.permissionsController.QueryAllUsersRequiredOnHost(hostId);

        const userIdsToRemove = members.Values().Map(x => x.id).ToSet().Without(userIds);
        for (const userIdToRemove of userIdsToRemove)
            await this.DeleteUserFromHost(hostId, userIdToRemove);
    }

    public async ResolveHostGroupId(hostId: number, linuxGroupName: string)
    {
        const result = await this.remoteCommandExecutor.ExecuteBufferedCommand(["getent", "group", linuxGroupName], hostId);
        const parts = result.stdOut.split(":");
        return parseInt(parts[2]);
    }

    public async ResolveHostUserId(hostId: number, linuxUserName: string)
    {
        const uid = await this.TryResolveHostUserId(hostId, linuxUserName);
        return uid!;
    }

    public async SyncGroupToHost(hostId: number, userGroupId: number)
    {
        const linuxGroupName = this.MapGroupToLinuxGroupName(userGroupId);
        const gid = await this.TryResolveHostUserGroupId(hostId, linuxGroupName);
        if(gid === undefined)
            await this.CreateHostGroup(hostId, linuxGroupName);

        const members = await this.usersController.QueryMembersOfGroup(userGroupId);
        for (const member of members)
            await this.SyncUserToHost(hostId, member.id);

        await this.SyncGroupMembersToHost(hostId, linuxGroupName, members.Values().Map(x => x.id).Map(this.MapUserToLinuxUserName.bind(this)).ToSet());
    }

    public async SyncGroupsToHost(hostId: number, userGroupIds: number[])
    {
        for (const userGroupId of userGroupIds)
            await this.SyncGroupToHost(hostId, userGroupId);
    }

    public async SyncSambaGroupMembers(hostId: number, userGroupId: number)
    {
        const members = await this.usersController.QueryMembersOfGroup(userGroupId);
        for (const member of members)
            await this.SyncSambaUserToHost(hostId, member.id);
    }

    public async SyncSambaGroupsMembers(hostId: number, userGroupIds: number[])
    {
        for (const userGroupId of userGroupIds)
        {
            await this.SyncSambaGroupMembers(hostId, userGroupId);
        }
    }

    public async SyncSambaUserToHost(hostId: number, userId: number)
    {
        const exists = await this.DoesSambaUserExistOnHost(hostId, userId);
        if(!exists)
            await this.AddDisabledSambaUser(hostId, this.MapUserToLinuxUserName(userId));
    }
    
    public async UpdateSambaPasswordOnHostIfExisting(hostId: number, userId: number, newPw: string)
    {
        const exists = await this.DoesSambaUserExistOnHost(hostId, userId);
        if(exists)
        {
            await this.UpdateSambaPassword(hostId, this.MapUserToLinuxUserName(userId), newPw);
            await this.EnableSambaUser(hostId, userId);
        }
    }

    //Private methods
    private async AddDisabledSambaUser(hostId: number, userName: string)
    {
        await this.remoteCommandExecutor.ExecuteCommand(["sudo", "smbpasswd", "-sad", userName], hostId);
    }

    private async CreateHostGroup(hostId: number, linuxGroupName: string)
    {
        const gid = this.MapOPCIdToLinuxId(this.MapLinuxGroupNameToGroupId(linuxGroupName));
        await this.remoteCommandExecutor.ExecuteCommand(["sudo", "groupadd", "-g", gid.toString(), linuxGroupName], hostId);
    }

    private async CreateHostUser(hostId: number, linuxUserName: string, primaryLinuxGroupName: string)
    {
        const uid = this.MapOPCIdToLinuxId(this.MapLinuxUserNameToUserId(linuxUserName));
        await this.remoteCommandExecutor.ExecuteCommand(["sudo", "useradd", "-M", "-u", uid.toString(), "-g", primaryLinuxGroupName, linuxUserName], hostId);
    }

    private async DeleteHostGroup(hostId: number, linuxGroupName: string)
    {
        await this.remoteCommandExecutor.ExecuteCommand(["sudo", "groupdel", linuxGroupName], hostId);
    }

    private async DeleteHostUser(hostId: number, linuxUserName: string)
    {
        await this.remoteCommandExecutor.ExecuteCommand(["sudo", "userdel", linuxUserName], hostId);
    }

    private async DeleteUserFromHost(hostId: number, userId: number)
    {
        const linuxUserName = this.MapUserToLinuxUserName(userId);
        await this.remoteCommandExecutor.ExecuteCommand(["sudo", "smbpasswd", "-s", "-x", linuxUserName], hostId);
        await this.DeleteHostUser(hostId, linuxUserName);
    }

    private async DeleteUserFromHostIfNotUsed(hostId: number, userId: number)
    {
        const isRequired = await this.permissionsController.IsUserRequiredOnHost(hostId, userId);
        if(!isRequired)
            await this.DeleteUserFromHost(hostId, userId);
    }

    private async DoesSambaUserExistOnHost(hostId: number, userId: number)
    {
        const sambaUsers = await this.QuerySambaUsers(hostId);
        const linuxUserName = this.MapUserToLinuxUserName(userId);
        const user = sambaUsers.find(x => x.unixUserName === linuxUserName);
        return user !== undefined;
    }

    private async EnableSambaUser(hostId: number, userId: number)
    {
        const linuxUserName = this.MapUserToLinuxUserName(userId);
        await this.remoteCommandExecutor.ExecuteCommand(["sudo", "smbpasswd", "-se", linuxUserName], hostId);
    }

    private MapLinuxGroupNameToGroupId(linuxUserName: string)
    {
        const idPart = linuxUserName.substring(opcGroupPrefixes.group.length);
        return parseInt(idPart);
    }

    private MapOPCIdToLinuxId(userOrGroupId: number)
    {
        //We reserve a cross-host unique id for a user or group so that file permissions are still intact even if switchting to another host (for example because the original host is not usable anymore)

        //We reserve the following range of uid/gid-s for OPC users/groups: 40000-49999 (see https://en.wikipedia.org/wiki/User_identifier)
        if(userOrGroupId > 9999)
            throw new Error("User or group id is out of supported range :S");

        return 40000 + userOrGroupId;
    }

    private async QuerySambaUsers(hostId: number)
    {
        const result = await this.remoteCommandExecutor.ExecuteBufferedCommand(["sudo", "pdbedit", "-L", "-v"], hostId);
        const lines = result.stdOut.split("\n");

        const users: SambaUser[] = [];
        for (let index = 0; index < lines.length; index++)
        {
            const line = lines[index].trimEnd();
            const match = line.match(/^Unix username:[ \t]+([a-z0-9\-]+)$/);
            if(match !== null)
            {
                const flagsLine = lines[index + 2].substr("Account Flags:".length);

                users.push({ unixUserName: match[1], enabled: flagsLine.indexOf("D") === -1 });
                index += 1;
            }
        }
        return users;
    }

    private async SyncGroupMembersToHost(hostId: number, linuxGroupName: string, desiredLinuxUserNames: Set<string>)
    {
        const currentLinuxUserNamesEnumeration = await this.linuxUsersManager.QueryMembersOfGroup(hostId, linuxGroupName);
        const currentLinuxUserNames = currentLinuxUserNamesEnumeration.ToSet();

        const toRemove = currentLinuxUserNames.Without(desiredLinuxUserNames);
        const toAdd = desiredLinuxUserNames.Without(currentLinuxUserNames);

        for (const linuxUserName of toRemove)
        {
            await this.remoteCommandExecutor.ExecuteCommand(["sudo", "deluser", linuxUserName, linuxGroupName], hostId);
            await this.DeleteUserFromHostIfNotUsed(hostId, this.MapLinuxUserNameToUserId(linuxUserName));
        }
        for (const linuxUserName of toAdd)
            await this.linuxUsersManager.AddUserToGroup(hostId, linuxUserName, linuxGroupName);
    }

    /**
     * @returns The host user id
     */
     private async SyncUserToHost(hostId: number, userId: number)
     {
         const linuxUserName = this.MapUserToLinuxUserName(userId);
         const uid = await this.TryResolveHostUserId(hostId, linuxUserName);
         if(uid === undefined)
         {
            const gid = await this.TryResolveHostUserGroupId(hostId, opcSpecialGroups.userPrimaryGroup);
            if(gid === undefined)
                await this.remoteCommandExecutor.ExecuteCommand(["sudo", "groupadd", "-g", "50001", opcSpecialGroups.userPrimaryGroup], hostId);

             await this.CreateHostUser(hostId, linuxUserName, opcSpecialGroups.userPrimaryGroup);
             return await this.ResolveHostUserId(hostId, linuxUserName);
         }
         return uid;
     }

    private async TryResolveHostUserGroupId(hostId: number, linuxGroupName: string)
    {
        const result = await this.remoteCommandExecutor.ExecuteBufferedCommandWithExitCode(["getent", "group", linuxGroupName], hostId);
        if(result.stdOut.length === 0)
            return undefined;
        if(result.exitCode === 2)
            return undefined;
        return parseInt(result.stdOut.split(":")[2]);
    }

    private async TryResolveHostUserId(hostId: number, linuxUserName: string)
    {
        const result = await this.remoteCommandExecutor.ExecuteBufferedCommandWithExitCode(["id", "-u", linuxUserName], hostId);
        const uid = parseInt(result.stdOut);
        if(isNaN(uid))
            return undefined;
        if(result.exitCode === 1)
            return undefined;
        return uid;
    }

    /**
     * If the user already exists it is basically "overwritten", i.e. only the password is changed, but otherwise the user is created.
     */
    private async UpdateSambaPassword(hostId: number, userName: string, password: string)
    {
        const stdin = (password + "\n") + (password + "\n");
        await this.remoteCommandExecutor.ExecuteCommand(["sudo", "smbpasswd", "-s", "-a", userName], hostId, {
            stdin
        });
    }
}