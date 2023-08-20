/**
 * OpenPrivateCloud
 * Copyright (C) 2019-2023 Amir Czwink (amir130@hotmail.de)
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
 import { Injectable, LockedProperty } from "acts-util-node";
import { opcSpecialUsers } from "../common/UserAndGroupDefinitions";
 import { HostsController } from "../data-access/HostsController";
 import { SSHConnection, SSHService } from "./SSHService";
 
interface ConnectionInfo
{
    sshConn: LockedProperty<SSHConnection>;
}

@Injectable
export class RemoteConnectionsManager
{
    constructor(private sshService: SSHService, private hostsController: HostsController)
    {
        this.connections = {};
    }

    //Public methods
    public async AcquireConnection(hostId: number)
    {
        let conn = this.connections[hostId];
        if(conn === undefined)
        {
            conn = this.connections[hostId] = {
                sshConn: new LockedProperty(await this.AcquireNewSelfManagedConnection(hostId))
            };
        }

        return await conn.sshConn.Lock();
    }

    public async AcquireNewSelfManagedConnection(hostId: number)
    {
        const creds = await this.hostsController.RequestHostCredentials(hostId);
        if(creds === undefined)
            throw new Error("unknown host");

        return await this.sshService.ConnectWithCredentials(creds.hostName, opcSpecialUsers.host, creds.password);
    }

    //Private variables
    private connections: Dictionary<ConnectionInfo>;
}