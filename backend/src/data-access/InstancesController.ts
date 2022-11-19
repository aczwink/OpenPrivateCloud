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

export interface Instance
{
    fullName: string;
    storageId: number;
}

export interface FullInstance extends Instance
{
    id: number;
}

export interface InstancePermission
{
    /**
     * @title Usergroup
     * @format usergroup
     */
    userGroupId: number;
    permission: string;
}

@Injectable
export class InstancesController
{
    constructor(private dbConnMgr: DBConnectionsManager)
    {
    }

    //Public methods
    public async AddInstance(storageId: number, fullName: string)
    {
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        const result = await conn.InsertRow("instances", { storageId, fullName });
        return result.insertId;
    }

    public async AddInstancePermission(fullInstanceName: string, instancePermission: InstancePermission)
    {
        const instanceId = await this.QueryInstanceId(fullInstanceName);

        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        await conn.InsertRow("instances_permissions", { instanceId, userGroupId: instancePermission.userGroupId, permission: instancePermission.permission });
    }

    public async DeleteInstance(fullInstanceName: string)
    {
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        await conn.DeleteRows("instances", "fullName = ?", fullInstanceName)
    }

    public async DeleteInstancePermission(fullInstanceName: string, instancePermission: InstancePermission)
    {
        const instanceId = await this.QueryInstanceId(fullInstanceName);

        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        await conn.DeleteRows("instances_permissions", "instanceId = ? AND userGroupId = ? AND permission = ?", instanceId!, instancePermission.userGroupId, instancePermission.permission)
    }

    public async QueryHostIdOfInstance(fullInstanceName: string)
    {
        const query = `
        SELECT hs.hostId
        FROM instances i
        INNER JOIN hosts_storages hs
            ON i.storageId = hs.id
        WHERE i.fullName = ?
        `;
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        const row = await conn.SelectOne(query, fullInstanceName);
        if(row === undefined)
            return undefined;

        return row.hostId as number;
    }

    public async QueryInstance(fullInstanceName: string)
    {
        const query = `
        SELECT id, fullName, storageId
        FROM instances
        WHERE fullName = ?
        `;
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        return await conn.SelectOne<FullInstance>(query, fullInstanceName);
    }

    public async QueryInstanceById(instanceId: number)
    {
        const query = `
        SELECT id, fullName, storageId
        FROM instances
        WHERE id = ?
        `;
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        return await conn.SelectOne<FullInstance>(query, instanceId);
    }

    public async QueryInstanceIdsAssociatedWithHost(hostId: number)
    {
        const query = `
        SELECT i.id
        FROM instances i
        INNER JOIN hosts_storages hs
            ON hs.id = i.storageId
        WHERE hs.hostId = ?
        `;
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        const rows = await conn.Select(query, hostId);
        return rows.map(x => x.id as number);
    }

    public async QueryInstancePermissions(fullInstanceName: string)
    {
        const query = `
        SELECT ip.userGroupId, ip.permission
        FROM instances_permissions ip
        INNER JOIN instances i
            ON i.id = ip.instanceId
        WHERE i.fullName = ?
        `;
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        return await conn.Select<InstancePermission>(query, fullInstanceName);
    }

    public async QueryInstances()
    {
        const query = `
        SELECT fullName, storageId
        FROM instances
        `;
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        return await conn.Select<Instance>(query);
    }

    public async Search(hostName: string, fullNamePattern: string)
    {
        const query = `
        SELECT i.fullName, i.storageId
        FROM instances i
        INNER JOIN hosts_storages hs
            ON hs.id = i.storageId
        INNER JOIN hosts h
            ON h.id = hs.hostId
        WHERE h.hostName = ? AND i.fullName LIKE ?
        `;
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        return await conn.Select<Instance>(query, hostName, fullNamePattern);
    }

    //Private methods
    private async QueryInstanceId(fullInstanceName: string)
    {
        const query = `
        SELECT id
        FROM instances
        WHERE fullName = ?
        `;
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        const row = await conn.SelectOne(query, fullInstanceName);

        if(row === undefined)
            return undefined;
        return row.id as number;
    }
}