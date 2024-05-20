/**
 * OpenPrivateCloud
 * Copyright (C) 2019-2024 Amir Czwink (amir130@hotmail.de)
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

import { DBExpression, Injectable } from "acts-util-node";
import { DBConnectionsManager } from "./DBConnectionsManager";
import { ResourceCheckType } from "../resource-providers/ResourceProvider";

export enum HealthStatus
{
    Up = 1,
    Down = 2,
    Corrupt = 3,
    InDeployment = 4
}

interface HostHealthData
{
    status: HealthStatus;
    log: string;
}

export interface ResourceHealthData
{
    checkType: ResourceCheckType;
    status: HealthStatus;
    /**
     * @format multi-line
     */
    log: string;
    lastSuccessfulCheck: Date;
}

export interface HealthStats
{
    status: HealthStatus;
    cnt: number;
}

@Injectable
export class HealthController
{
    constructor(private dbConnMgr: DBConnectionsManager)
    {
    }

    //Public methods
    public async DeleteInstanceHealthData(resourceId: number)
    {
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        await conn.DeleteRows("resources_health", "resourceId = ?", resourceId);
    }

    public async QueryHostsHealthStats()
    {
        const query = `
        SELECT status, COUNT(*) as cnt
        FROM hosts_health
        GROUP BY status;
        `;
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        return await conn.Select<HealthStats>(query);
    }

    public async QueryHostHealthData(hostId: number): Promise<HostHealthData | undefined>
    {
        const query = `
        SELECT status, log
        FROM hosts_health
        WHERE hostId = ?
        `;
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        const row = await conn.SelectOne(query, hostId);
        if(row === undefined)
            return undefined;


        return {
            status: row.status,
            log: row.log
        };
    }

    public async QueryResourceHealthData(resourceId: number): Promise<ResourceHealthData[]>
    {
        const query = `
        SELECT checkType, status, log, lastSuccessfulCheck
        FROM resources_health
        WHERE resourceId = ?
        `;
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        const rows = await conn.Select(query, resourceId);

        return rows.map(row => ({
            checkType: row.checkType,
            status: row.status,
            log: row.log,
            lastSuccessfulCheck: this.dbConnMgr.ParseDateTime(row.lastSuccessfulCheck),
        }));
    }

    public async QueryResourcesHealthStats()
    {
        const query = `
        SELECT status, COUNT(*) as cnt
        FROM (
            SELECT MAX(status) AS status
            FROM resources_health
            GROUP BY resourceId
        ) tbl
        GROUP BY status;
        `;
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        return await conn.Select<HealthStats>(query);
    }

    public async UpdateHostHealth(hostId: number, status: HealthStatus, log: string)
    {
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();

        const result = await conn.UpdateRows("hosts_health", { status, log }, "hostId = ?", hostId);

        if(result.affectedRows === 0)
        {
            await conn.InsertRow("hosts_health", {
                hostId,
                status,
                log
            });
        }
    }

    public async UpdateResourceHealth(resourceId: number, checkType: ResourceCheckType, status: HealthStatus, log: string)
    {
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();

        const result = await conn.UpdateRows("resources_health", {
            checkType,
            status,
            lastSuccessfulCheck: (status === HealthStatus.Up) ? DBExpression("NOW()") : undefined,
            log,
        }, "resourceId = ? AND checkType = ?", resourceId, checkType);

        if(result.affectedRows === 0)
        {
            await conn.InsertRow("resources_health", {
                resourceId,
                checkType,
                status,
                lastSuccessfulCheck: (status === HealthStatus.Up) ? DBExpression("NOW()") : "0000-00-00 00:00:00",
                log,
            });
        }
    }
}