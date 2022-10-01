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
 
@Injectable
export class HostUsersManager
{
    constructor(private remoteCommandExecutor: RemoteCommandExecutor)
    {
    }

    //Public methods
    /**
     * @returns The host user id
     */
    public async EnsureUserIsSyncedToHost(hostId: number, userId: number)
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

    //Private methods
    private async CreateHostUser(hostId: number, linuxUserName: string)
    {
        await this.remoteCommandExecutor.ExecuteCommand(["sudo", "useradd", "-M", "-g", "nogroup", linuxUserName], hostId);
    }
    
    private MapUserToLinuxUserName(userId: number)
    {
        return "opc-u" + userId;
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