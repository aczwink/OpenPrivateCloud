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

@Injectable
export class PermissionsController
{
    constructor(private dbConnMgr: DBConnectionsManager)
    {
    }

    //Public methods
    public async HasUserClusterWidePermission(userId: number, permission: string)
    {
        const query = `
        SELECT TRUE
        FROM cluster_roleAssignments cra
        INNER JOIN usergroups_members ugm
            ON ugm.groupId = cra.userGroupId AND ugm.userId = ?
        INNER JOIN roles_permissions rp
            ON cra.roleId = rp.roleId
        WHERE rp.permission = ?
        `;

        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        const row = await conn.SelectOne(query, userId, permission);

        return row !== undefined;
    }

    public async IsUserRequiredOnHost(hostId: number, userId: number)
    {
        let query = `
        SELECT TRUE
        FROM usergroups_members ugm
        INNER JOIN instances_roleAssignments ira
            ON ugm.groupId = ira.userGroupId
        INNER JOIN instances i
            ON i.id = ira.instanceId
        INNER JOIN hosts_storages hs
            ON hs.id = i.storageId
        WHERE hs.hostId = ? AND ugm.userId = ?
        `;

        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        const row = await conn.SelectOne(query, hostId, userId);

        return row !== undefined;
    }

    public async QueryAllUsersRequiredOnHost(hostId: number)
    {        
        const query = `
        SELECT ugm.userId
        FROM usergroups_members ugm
        INNER JOIN instances_roleAssignments ira
            ON ugm.groupId = ira.userGroupId
        INNER JOIN instances i
            ON i.id = ira.instanceId
        INNER JOIN hosts_storages hs
            ON hs.id = i.storageId
        WHERE hs.hostId = ?
        `;

        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        const rows = await conn.Select(query, hostId);

        return rows.Values().Map(x => x.userId as number).ToSet();
    }

    public async QueryGroupsAssociatedWithHost(hostId: number)
    {
        let query = `
        SELECT ira.userGroupId
        FROM instances_roleAssignments ira
        INNER JOIN instances i
            ON ira.instanceId = i.id
        INNER JOIN hosts_storages hs
            ON i.storageId = hs.id
        WHERE hs.hostId = ?
        `;

        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        const rows = await conn.Select(query, hostId);

        return rows.Values().Map(x => x.userGroupId as number).ToSet();
    }

    public async QueryGroupsWithPermission(instanceId: number, permission: string)
    {
        let query = `
        SELECT ira.userGroupId
        FROM instances_roleAssignments ira
        INNER JOIN roles_permissions rp
            ON rp.roleId = ira.roleId
        WHERE ira.instanceId = ? AND rp.permission = ?
        `;

        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        const rows = await conn.Select(query, instanceId, permission);

        return rows.Values().Map(x => x.userGroupId as number);
    }

    public async QueryHostsAssociatedWithGroup(userGroupId: number)
    {
        let query = `
        SELECT DISTINCT hs.hostId
        FROM hosts_storages hs
        INNER JOIN instances i
            ON i.storageId = hs.id
        INNER JOIN instances_roleAssignments ira
            ON ira.instanceId = i.id
        WHERE ira.userGroupId = ?
        `;

        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        const rows = await conn.Select(query, userGroupId);

        return rows.Values().Map(x => x.hostId as number);
    }

    public async QueryInstancesAssociatedWithGroup(userGroupId: number)
    {
        let query = `
        SELECT DISTINCT i.fullName
        FROM instances i
        INNER JOIN instances_roleAssignments ira
            ON ira.instanceId = i.id
        WHERE ira.userGroupId = ?
        `;

        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        const rows = await conn.Select(query, userGroupId);

        return rows.Values().Map(x => x.fullName as string);
    }

    public async QueryInstanceIdsThatUserHasAccessTo(userId: number)
    {
        const query = `
        SELECT i.id
        FROM instances i
        INNER JOIN instances_roleAssignments ira
            ON ira.instanceId = i.id
        INNER JOIN usergroups_members ugm
            ON ugm.groupId = ira.userGroupId
        INNER JOIN roles_permissions rp
            ON rp.roleId = ira.roleId AND rp.permission = '/read'
        WHERE ugm.userId = ?
        `;

        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        const rows = await conn.Select(query, userId);

        return rows.Values().Map(x => x.id as number);
    }
}