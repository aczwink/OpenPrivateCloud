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

import { DBExpression, Injectable } from "acts-util-node";
import { ErrorService } from "../services/ErrorService";
import { DBConnectionsManager } from "./DBConnectionsManager";

export enum HealthStatus
{
    Up = 1,
    Down = 2,
    Corrupt = 3,
    InDeployment = 4
}

interface InstanceHealthData
{
    status: HealthStatus;
    
    /**
     * @format multi-line
     */
    availabilityLog: string;

    lastSuccessfulCheck: Date;

    /**
     * @format multi-line
     */
    checkLog: string;
}

export interface HealthStats
{
    status: HealthStatus;
    cnt: number;
}

@Injectable
export class HealthController
{
    constructor(private dbConnMgr: DBConnectionsManager, private errorService: ErrorService)
    {
    }

    //Public methods
    public async DeleteInstanceHealthData(instanceId: number)
    {
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        await conn.DeleteRows("instances_health", "instanceId = ?", instanceId);
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

    public async QueryInstanceHealthData(instanceId: number): Promise<InstanceHealthData | undefined>
    {
        const query = `
        SELECT status, availabilityLog, lastSuccessfulCheck, checkLog
        FROM instances_health
        WHERE instanceId = ?
        `;
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        const row = await conn.SelectOne(query, instanceId);
        if(row === undefined)
            return undefined;


        return {
            status: row.status,
            availabilityLog: row.availabilityLog,
            lastSuccessfulCheck: this.dbConnMgr.ParseDateTime(row.lastSuccessfulCheck),
            checkLog: row.checkLog
        };
    }

    public async QueryInstancesHealthStats()
    {
        const query = `
        SELECT status, COUNT(*) as cnt
        FROM instances_health
        GROUP BY status;
        `;
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        return await conn.Select<HealthStats>(query);
    }

    public async UpdateHostHealth(hostId: number, status: HealthStatus, logData?: unknown)
    {
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();

        const log = this.errorService.ExtractDataAsMultipleLines(logData);
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

    public async UpdateInstanceAvailability(instanceId: number, status: HealthStatus, logData?: unknown)
    {
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();

        const log = this.errorService.ExtractDataAsMultipleLines(logData);
        const result = await conn.UpdateRows("instances_health", {
            status: DBExpression(`IF((status = ${HealthStatus.Down}) or (status = ${HealthStatus.Up}), ${status}, status)`),
            availabilityLog: log
        }, "instanceId = ?", instanceId);

        if(result.affectedRows === 0)
        {
            await conn.InsertRow("instances_health", {
                instanceId,
                status,
                availabilityLog: log,
                lastSuccessfulCheck: "0000-00-00 00:00:00",
                checkLog: ""
            });
        }
    }

    public async UpdateInstanceHealth(instanceId: number, status: HealthStatus, logData?: unknown)
    {
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();

        const lastSuccessfulCheck = (status === HealthStatus.Up) ? DBExpression("NOW()") : undefined;
        const log = this.errorService.ExtractDataAsMultipleLines(logData);

        const result = await conn.UpdateRows("instances_health", {
            status: DBExpression("GREATEST(status, " + status + ")"),
            lastSuccessfulCheck,
            checkLog: log,
        }, "instanceId = ?", instanceId);

        if(result.affectedRows === 0)
        {
            await conn.InsertRow("instances_health", {
                instanceId,
                status,
                availabilityLog: "",
                lastSuccessfulCheck,
                checkLog: log,
            });
        }
    }
}