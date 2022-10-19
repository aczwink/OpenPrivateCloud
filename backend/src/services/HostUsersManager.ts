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
import { HostsController } from "../data-access/HostsController";
import { PermissionsController } from "../data-access/PermissionsController";
import { UsersController } from "../data-access/UsersController";
import { RemoteCommandExecutor } from "./RemoteCommandExecutor";
import { SSHService } from "./SSHService";

interface SambaUser
{
    unixUserName: string;
    enabled: boolean;
}
 
@Injectable
export class HostUsersManager
{
    constructor(private remoteCommandExecutor: RemoteCommandExecutor, private usersController: UsersController,
        private sshService: SSHService, private hostsController: HostsController, private permissionsController: PermissionsController)
    {
    }

    //Public methods
    public async EnsureSambaUserIsSyncedToHost(hostId: number, userId: number)
    {
        const linuxUserName = this.MapUserToLinuxUserName(userId);
        const sambaUsers = await this.QuerySambaUsers(hostId);

        const user = sambaUsers.find(x => x.unixUserName === linuxUserName);
        if(user === undefined)
        {
            const privateData = await this.usersController.QueryPrivateData(userId);
            await this.AddSambaUser(hostId, linuxUserName, privateData!.sambaPW);
        }
    }

    public async RemoveGroupFromHost(hostId: number, userGroupId: number)
    {
        const linuxGroupName = this.MapGroupToLinuxGroupName(userGroupId);
        await this.remoteCommandExecutor.ExecuteCommand(["sudo", "groupdel", linuxGroupName], hostId);

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
        const members = await this.usersController.QueryMembersOfGroup(userGroupId);
        for (const member of members)
            await this.SyncUserToHost(hostId, member.id);

        const linuxGroupName = this.MapGroupToLinuxGroupName(userGroupId);
        const gid = await this.TryResolveHostUserGroupId(hostId, linuxGroupName);
        if(gid === undefined)
            await this.CreateHostGroup(hostId, linuxGroupName);

        await this.SyncGroupMembersToHost(hostId, linuxGroupName, members.Values().Map(x => x.id).Map(this.MapUserToLinuxUserName.bind(this)).ToSet());
    }

    /**
     * @returns The host user id
     */
     public async SyncUserToHost(hostId: number, userId: number)
     {
         const linuxUserName = this.MapUserToLinuxUserName(userId);
         const uid = await this.TryResolveHostUserId(hostId, linuxUserName);
         if(uid === undefined)
         {
             await this.CreateHostUser(hostId, linuxUserName);
             return await this.ResolveHostUserId(hostId, linuxUserName);
         }
         return uid;
     }

    //Private methods
    private async AddSambaUser(hostId: number, userName: string, password: string)
    {
        const host = await this.hostsController.RequestHostCredentials(hostId);
        console.log("conn go");
        const conn = await this.sshService.ConnectWithCredentials(host!.hostName, "opc", host!.password);

        console.log("command go");
        const channel = await conn.ExecuteInteractiveCommand(["sudo", "smbpasswd", "-s", "-a", userName]);
        console.log("command ok");

        channel.stdout.setEncoding("utf-8");
        channel.stderr.setEncoding("utf-8");
        channel.stdout.on("data", console.log);
        channel.stderr.on("data", console.error);

        console.log("command write pw");

        channel.stdin.write(password + "\n");
        channel.stdin.write(password + "\n");

        console.log("command close");

        const res = await new Promise<boolean>( (resolve, reject) => {
            channel.on("exit", code => resolve(code === "0"));
            channel.on("error", reject);
        });
        console.log("res", res);

        conn.Close();
    }

    private async CreateHostGroup(hostId: number, linuxGroupName: string)
    {
        await this.remoteCommandExecutor.ExecuteCommand(["sudo", "groupadd", linuxGroupName], hostId);
    }

    private async CreateHostUser(hostId: number, linuxUserName: string)
    {
        await this.remoteCommandExecutor.ExecuteCommand(["sudo", "useradd", "-M", "-g", "nogroup", linuxUserName], hostId);
    }

    private async DeleteUserFromHost(hostId: number, userId: number)
    {
        const linuxUserName = this.MapUserToLinuxUserName(userId);
        await this.remoteCommandExecutor.ExecuteCommand(["sudo", "smbpasswd", "-x", linuxUserName], hostId);
        await this.remoteCommandExecutor.ExecuteCommand(["sudo", "userdel", linuxUserName], hostId);
    }

    private MapGroupToLinuxGroupName(userGroupId: number)
    {
        return "opc-g" + userGroupId;
    }
    
    private MapUserToLinuxUserName(userId: number)
    {
        return "opc-u" + userId;
    }

    private async QuerySambaUsers(hostId: number)
    {
        const result = await this.remoteCommandExecutor.ExecuteBufferedCommand(["sudo", "pdbedit", "-L", "-v"], hostId);
        const lines = result.stdOut.split("\n");

        const users: SambaUser[] = [];
        for (let index = 0; index < lines.length; index++)
        {
            const line = lines[index].trimEnd();
            const match = line.match(/^Unix username:[ \t]+([a-z]+)$/);
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
        const result = await this.remoteCommandExecutor.ExecuteBufferedCommand(["getent", "group", linuxGroupName], hostId);

        const currentLinuxUserNames = result.stdOut.trimEnd().split(":")[3].split(",").Values().Filter(x => x.length > 0).ToSet();
        const toRemove = currentLinuxUserNames.Without(desiredLinuxUserNames);
        const toAdd = desiredLinuxUserNames.Without(currentLinuxUserNames);

        for (const linuxUserName of toRemove)
            await this.remoteCommandExecutor.ExecuteCommand(["sudo", "deluser", linuxUserName, linuxGroupName], hostId);
        for (const linuxUserName of toAdd)
            await this.remoteCommandExecutor.ExecuteCommand(["sudo", "usermod", "-a", "-G", linuxGroupName, linuxUserName], hostId);
    }

    private async TryResolveHostUserGroupId(hostId: number, linuxGroupName: string)
    {
        const result = await this.remoteCommandExecutor.ExecuteBufferedCommand(["getent", "group", linuxGroupName], hostId);
        if(result.stdOut.length === 0)
            return undefined;
        return parseInt(result.stdOut.split(":")[2]);
    }

    private async TryResolveHostUserId(hostId: number, linuxUserName: string)
    {
        const result = await this.remoteCommandExecutor.ExecuteBufferedCommand(["id", "-u", linuxUserName], hostId);
        const uid = parseInt(result.stdOut);
        if(isNaN(uid))
            return undefined;
        return uid;
    }
}