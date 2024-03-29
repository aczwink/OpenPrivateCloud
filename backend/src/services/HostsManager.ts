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
import { Injectable } from "acts-util-node";
import { HostsController } from "../data-access/HostsController";
import { ClusterKeyStoreManager } from "./ClusterKeyStoreManager";

@Injectable
export class HostsManager
{
    constructor(private hostsController: HostsController, private clusterKeyStoreManager: ClusterKeyStoreManager)
    {
    }

    //Public methods
    public async QueryHostCredentials(hostId: number)
    {
        const host = await this.hostsController.QueryHost(hostId);
        if(host === undefined)
            return undefined;
        return {
            hostName: host.hostName,
            password: (await this.clusterKeyStoreManager.QueryHostSecret(hostId, "sshpw"))!
        };
    }

    public async SetHostPassword(hostId: number, password: string)
    {
        await this.clusterKeyStoreManager.SetHostSecret(hostId, "sshpw", password);
    }
}