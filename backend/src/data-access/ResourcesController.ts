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
import { DBConnectionsManager } from "./DBConnectionsManager";

export interface Resource
{
    id: number;
    instanceGroupId: number;
    name: string;
    storageId: number;
    resourceProviderName: string;
    instanceType: string;
}

interface OverviewInstanceData
{
    name: string;
    resourceProviderName: string;
    instanceType: string;
    status: number;
}

@Injectable
export class ResourcesController
{
    constructor(private dbConnMgr: DBConnectionsManager)
    {
    }

    //Public methods
    public async AddInstance(instanceGroupId: number, storageId: number, resourceProviderName: string, instanceType: string, name: string)
    {
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        const result = await conn.InsertRow("instances", { instanceGroupId, storageId, resourceProviderName, instanceType, name });
        return result.insertId;
    }

    public async DeleteResource(resourceId: number)
    {
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        await conn.DeleteRows("instances", "id = ?", resourceId)
    }

    public async QueryAllResourceIdsInResourceGroup(resourceGroupId: number)
    {
        const query = `
        SELECT id
        FROM instances
        WHERE instanceGroupId = ?
        `;
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        const rows = await conn.Select(query, resourceGroupId);
        return rows.Values().Map(x => x.id as number);
    }

    public async QueryHostIdOfInstance(instanceId: number)
    {
        const query = `
        SELECT hs.hostId
        FROM instances i
        INNER JOIN hosts_storages hs
            ON i.storageId = hs.id
        WHERE i.id = ?
        `;
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        const row = await conn.SelectOne(query, instanceId);
        if(row === undefined)
            return undefined;

        return row.hostId as number;
    }

    public async QueryResource(id: number)
    {
        const query = `
        SELECT id, name, storageId, resourceProviderName, instanceType, instanceGroupId
        FROM instances
        WHERE id = ?
        `;
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        return await conn.SelectOne<Resource>(query, id);
    }

    public async QueryResourceByName(resourceGroupName: string, resourceProviderName: string, resourceType: string, name: string)
    {
        const query = `
        SELECT i.id, i.name, i.storageId, i.resourceProviderName, i.instanceType
        FROM instances i
        INNER JOIN instancegroups ig
            ON ig.id = i.instanceGroupId
        WHERE i.name = ? AND i.resourceProviderName = ? AND i.instanceType = ? AND ig.name = ?
        LIMIT 1
        `;
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        return await conn.SelectOne<Resource>(query, name, resourceProviderName, resourceType, resourceGroupName);
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

    public async QueryOverviewInstanceData(instanceId: number)
    {
        const query = `
        SELECT i.name, i.resourceProviderName, i.instanceType, ih.status
        FROM instances i
        INNER JOIN instances_health ih
            ON ih.instanceId = i.id
        WHERE i.id = ?
        `;
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        return await conn.SelectOne<OverviewInstanceData>(query, instanceId);
    }

    public async Search(resourceProviderName: string, resourceTypeName: string, resourceNameFilter: string)
    {
        const query = `
        SELECT i.id
        FROM instances i
        WHERE i.resourceProviderName = ? AND i.instanceType = ? AND name LIKE ?
        `;
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        const rows = await conn.Select(query, resourceProviderName, resourceTypeName, "%" + resourceNameFilter + "%");
        return rows.map(x => x.id as number);
    }

    public async SearchOnHost(hostName: string, resourceProviderName: string, resourceTypeName: string, resourceNameFilter: string)
    {
        const query = `
        SELECT i.id
        FROM instances i
        INNER JOIN hosts_storages hs
            ON hs.id = i.storageId
        INNER JOIN hosts h
            ON h.id = hs.hostId
        WHERE h.hostName = ? AND i.resourceProviderName = ? AND i.instanceType = ? AND name LIKE ?
        `;
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        const rows = await conn.Select(query, hostName, resourceProviderName, resourceTypeName, "%" + resourceNameFilter + "%");
        return rows.map(x => x.id as number);
    }

    public async UpdateResourceGroup(id: number, newResourceGroupId: number)
    {
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        await conn.UpdateRows("instances", { instanceGroupId: newResourceGroupId }, "id = ?", id);
    }

    public async UpdateResourceName(id: number, name: string)
    {
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        await conn.UpdateRows("instances", { name }, "id = ?", id);
    }
}