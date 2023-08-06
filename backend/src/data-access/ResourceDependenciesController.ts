/**
 * OpenPrivateCloud
 * Copyright (C) 2023 Amir Czwink (amir130@hotmail.de)
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
export class ResourceDependenciesController
{
    constructor(private dbConnMgr: DBConnectionsManager)
    {
    }

    //Public methods
    public async DeleteDependenciesOf(resourceId: number)
    {
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();

        await conn.DeleteRows("resources_dependencies", "dependantResourceId = ?", resourceId);
    }

    public async EnsureResourceDependencyExists(resourceId: number, dependantResourceId: number)
    {
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();

        await conn.Query("INSERT IGNORE INTO resources_dependencies (resourceId, dependantResourceId) VALUES (?, ?)", [resourceId, dependantResourceId]);
    }

    public async QueryResourcesThatDependOn(resourceProviderName: string, resourceType: string, resourceId: number)
    {
        const query = `
        SELECT rd.dependantResourceId
        FROM resources_dependencies rd
        INNER JOIN instances r
            ON r.id = rd.dependantResourceId
        WHERE r.resourceProviderName = ? AND r.instanceType = ? AND rd.resourceId = ?
        `;
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        const rows = await conn.Select(query, resourceProviderName, resourceType, resourceId);
        return rows.map(x => x.dependantResourceId as number);
    }
}