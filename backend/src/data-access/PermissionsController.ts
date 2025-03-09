/**
 * OpenPrivateCloud
 * Copyright (C) 2019-2025 Amir Czwink (amir130@hotmail.de)
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
    public async GetObjectsWithClusterWidePermission(permission: string)
    {
        const query = `
        SELECT cra.objectId
        FROM cluster_roleAssignments cra
        INNER JOIN roles_permissions rp
            ON cra.roleId = rp.roleId
        WHERE rp.permission = ?
        `;

        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        const rows = await conn.Select<{ objectId: string }>(query, permission);
        return rows.Values().Map(x => x.objectId);
    }

    public async GetObjectsWithResourceGroupLevelPermission(resourceGroupId: number, permission: string)
    {
        const query = `
        SELECT igra.objectId
        FROM resourcegroups_roleAssignments igra
        INNER JOIN roles_permissions rp
            ON igra.roleId = rp.roleId
        WHERE igra.resourceGroupId = ? AND rp.permission = ?
        `;

        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        const rows = await conn.Select<{ objectId: string }>(query, resourceGroupId, permission);
        return rows.Values().Map(x => x.objectId);
    }

    public async GetObjectsWithResourceLevelPermission(resourceId: number, permission: string)
    {
        const query = `
        SELECT ira.objectId
        FROM resources_roleAssignments ira
        INNER JOIN roles_permissions rp
            ON ira.roleId = rp.roleId
        WHERE ira.resourceId = ? AND rp.permission = ?
        `;

        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        const rows = await conn.Select<{ objectId: string }>(query, resourceId, permission);
        return rows.Values().Map(x => x.objectId);
    }

    public async QueryResourceIdsWithDirectRoleAssignment(permission: string)
    {
        const query = `
        SELECT ira.resourceId
        FROM resources_roleAssignments ira
        INNER JOIN roles_permissions rp
            ON rp.roleId = ira.roleId
        WHERE rp.permission = ?
        `;

        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        const rows = await conn.Select<{ resourceId: number; }>(query, permission);

        return rows.Values().Map(x => x.resourceId);
    }

    public async QueryResourceIdsWithDirectRoleAssignmentInResourceGroup(resourceGroupId: number, permission: string)
    {
        const query = `
        SELECT ira.resourceId
        FROM resources_roleAssignments ira
        INNER JOIN instances i
            ON i.id = ira.resourceId
        INNER JOIN roles_permissions rp
            ON rp.roleId = ira.roleId
        WHERE rp.permission = ? AND i.instanceGroupId = ?
        `;

        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        const rows = await conn.Select<{ resourceId: number; }>(query, permission, resourceGroupId);

        return rows.Values().Map(x => x.resourceId);
    }
}