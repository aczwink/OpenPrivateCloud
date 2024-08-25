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

import { CreateDatabaseExpression, DateTime, Injectable } from "acts-util-node";
import { ProcessTracker } from "../services/ProcessTrackerManager";
import { DBConnectionsManager } from "./DBConnectionsManager";

interface ResourceLogOverviewData
{
    logId: number;
    startTime: Date;
    endTime: Date;
    status: number;
}

interface InstanceLog
{
    startTime: Date;
    endTime: Date;

    /**
     * @format multi-line
     */
    log: string;
}

@Injectable
export class ResourceLogsController
{
    constructor(private dbConnMgr: DBConnectionsManager)
    {
    }

    //Public methods
    public async AddResourceLog(instanceId: number, processTracker: ProcessTracker)
    {
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        await conn.InsertRow("instances_logs", {
            instanceId,
            startTime: processTracker.startTime,
            endTime: CreateDatabaseExpression({ type: "CurrentDateTime" }),
            log: processTracker.fullText,
            status: processTracker.status,
            title: processTracker.title
        });
    }

    public async DeleteLogsAssociatedWithInstance(instanceId: number)
    {
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();

        await conn.DeleteRows("instances_logs", "instanceId = ?", instanceId);
    }

    public async DeleteResourceLogsOlderThan(resourceId: number, timeStamp: DateTime)
    {
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();

        await conn.DeleteRows("instances_logs", "instanceId = ? AND endTime < ?", resourceId, timeStamp);
    }

    public async QueryInstanceLog(logId: number)
    {
        const query = `
        SELECT startTime, endTime, log
        FROM instances_logs
        WHERE logId = ?
        `;
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        const row = await conn.SelectOne<InstanceLog>(query, logId);

        return row;
    }

    public async QueryResourceLogs(resourceId: number)
    {
        const query = `
        SELECT il.logId, il.startTime, il.endTime, il.status
        FROM instances_logs il
        WHERE il.instanceId = ?
        `;
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        const rows = await conn.Select<ResourceLogOverviewData>(query, resourceId);

        return rows;
    }
}