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

export interface RoleAssignment
{
    /**
     * @title User/Group
     * @format oidpPrincipalObjectId
     */
    objectId: string;

    /**
     * @title Role
     * @format role
     */
    roleId: string;
}
 
@Injectable
export class RoleAssignmentsController
{
    constructor(private dbConnMgr: DBConnectionsManager)
    {
    }

    //Public methods
    public async AddClusterRoleAssignment(roleAssignment: RoleAssignment)
    {
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        await conn.InsertRow("cluster_roleAssignments", roleAssignment);
    }

    public async AddResourceLevelRoleAssignment(resourceId: number, roleAssignment: RoleAssignment)
    {
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        await conn.InsertRow("resources_roleAssignments", { resourceId, objectId: roleAssignment.objectId, roleId: roleAssignment.roleId });
    }

    public async AddInstanceGroupRoleAssignment(resourceGroupId: number, roleAssignment: RoleAssignment)
    {
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        await conn.InsertRow("resourcegroups_roleAssignments", { resourceGroupId, objectId: roleAssignment.objectId, roleId: roleAssignment.roleId });
    }

    public async DeleteClusterRoleAssignment(roleAssignment: RoleAssignment)
    {
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        await conn.DeleteRows("cluster_roleAssignments", "objectId = ? AND roleId = ?", roleAssignment.objectId, roleAssignment.roleId);
    }

    public async DeleteResourceLevelRoleAssignment(resourceId: number, roleAssignment: RoleAssignment)
    {
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        await conn.DeleteRows("resources_roleAssignments", "resourceId = ? AND objectId = ? AND roleId = ?", resourceId, roleAssignment.objectId, roleAssignment.roleId);
    }

    public async DeleteResourceGroupRoleAssignment(resourceGroupId: number, roleAssignment: RoleAssignment)
    {
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        await conn.DeleteRows("resourcegroups_roleAssignments", "resourceGroupId = ? AND objectId = ? AND roleId = ?", resourceGroupId, roleAssignment.objectId, roleAssignment.roleId);
    }

    public async QueryAllClusterRoleAssignments()
    {
        const query = `
        SELECT objectId, CAST(roleId AS char) AS roleId
        FROM cluster_roleAssignments
        `;

        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        const rows = await conn.Select<RoleAssignment>(query);

        return rows;
    }

    public async QueryResourceLevelRoleAssignments(resourceId: number)
    {
        const query = `
        SELECT ira.objectId, CAST(ira.roleId AS char) AS roleId
        FROM resources_roleAssignments ira
        WHERE ira.resourceId = ?
        `;
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        return await conn.Select<RoleAssignment>(query, resourceId);
    }

    public async QueryResourceGroupRoleAssignments(resourceGroupId: number)
    {
        const query = `
        SELECT igra.objectId, CAST(igra.roleId AS char) AS roleId
        FROM resourcegroups_roleAssignments igra
        WHERE igra.resourceGroupId = ?
        `;
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        return await conn.Select<RoleAssignment>(query, resourceGroupId);
    }
}