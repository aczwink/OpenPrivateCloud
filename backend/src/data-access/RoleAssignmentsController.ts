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

export interface RoleAssignment
{
    /**
     * @title Usergroup
     * @format usergroup
     */
    userGroupId: number;

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

    public async AddInstanceRoleAssignment(instanceId: number, roleAssignment: RoleAssignment)
    {
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        await conn.InsertRow("instances_roleAssignments", { instanceId, userGroupId: roleAssignment.userGroupId, roleId: roleAssignment.roleId });
    }

    public async DeleteClusterRoleAssignment(roleAssignment: RoleAssignment)
    {
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        await conn.DeleteRows("cluster_roleAssignments", "userGroupId = ? AND roleId = ?", roleAssignment.userGroupId, roleAssignment.roleId);
    }

    public async DeleteInstanceRoleAssignment(instanceId: number, roleAssignment: RoleAssignment)
    {
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        await conn.DeleteRows("instances_roleAssignments", "instanceId = ? AND userGroupId = ? AND roleId = ?", instanceId, roleAssignment.userGroupId, roleAssignment.roleId);
    }

    public async QueryAllClusterRoleAssignments()
    {
        const query = `
        SELECT userGroupId, CAST(roleId AS char) AS roleId
        FROM cluster_roleAssignments
        `;

        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        const rows = await conn.Select<RoleAssignment>(query);

        return rows;
    }

    public async QueryInstanceRoleAssignments(fullInstanceName: string)
    {
        const query = `
        SELECT ira.userGroupId, CAST(ira.roleId AS char) AS roleId
        FROM instances_roleAssignments ira
        INNER JOIN instances i
            ON i.id = ira.instanceId
        WHERE i.fullName = ?
        `;
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        return await conn.Select<RoleAssignment>(query, fullInstanceName);
    }
}