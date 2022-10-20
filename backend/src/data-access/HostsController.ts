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
import { DBConnectionsManager } from "./DBConnectionsManager";
import { HostStorage, HostStorageCreationProperties } from "./HostStoragesController";

interface Host
{
    /**
     * The network hostname/IP address under which the host can be reached
     * @title Hostname
     */
    hostName: string;
}

@Injectable
export class HostsController
{
    constructor(private dbConnMgr: DBConnectionsManager)
    {
    }

    //Public methods
    public async AddHost(hostName: string, password: string)
    {
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        const result = await conn.InsertRow("hosts", { hostName, password });
        return result.insertId;
    }

    public async AddHostStorage(hostId: number, props: HostStorageCreationProperties, fileSystemType: string)
    {
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        await conn.InsertRow("hosts_storages", { hostId, path: props.path, fileSystemType });
    }

    public async DeleteHost(hostName: string)
    {
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        await conn.DeleteRows("hosts", "hostName = ?", hostName);
    }

    public async RequestHost(hostName: string)
    {
        const query = `
        SELECT hostName
        FROM hosts
        WHERE hostName = ?
        `;
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        return conn.SelectOne<Host>(query, hostName);
    }

    public async RequestHostCredentials(hostId: number)
    {
        const query = `
        SELECT hostName, password
        FROM hosts
        WHERE id = ?
        `;
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        return conn.SelectOne<{ hostName: string, password: string }>(query, hostId);
    }

    public async RequestHostId(hostName: string)
    {
        const query = `
        SELECT id
        FROM hosts
        WHERE hostName = ?
        `;
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        const result = await conn.SelectOne(query, hostName);
        if(result === undefined)
            return undefined;
        return result.id as number;
    }

    public async RequestHosts()
    {
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        return conn.Select<Host>("SELECT hostName FROM hosts");
    }

    public async RequestHostStorages(hostId: number)
    {
        const query = `
        SELECT id, hostId, path, fileSystemType
        FROM hosts_storages
        WHERE hostId = ?
        `;
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        return await conn.Select<HostStorage>(query, hostId);
    }
}