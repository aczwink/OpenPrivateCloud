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
import { ProcessTracker } from "../services/ProcessTrackerManager";
import { DBConnectionsManager } from "./DBConnectionsManager";

interface InstanceLogOverviewData
{
    logId: number;
    startTime: Date;
    endTime: Date;
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
export class InstanceLogsController
{
    constructor(private dbConnMgr: DBConnectionsManager)
    {
    }

    //Public methods
    public async AddInstanceLog(instanceId: number, processTracker: ProcessTracker)
    {
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        await conn.InsertRow("instances_logs", {
            instanceId,
            startTime: processTracker.startTime,
            endTime: "NOW()",
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

    public async QueryInstanceLogs(fullInstanceName: string)
    {
        const query = `
        SELECT il.logId, il.startTime, il.endTime
        FROM instances_logs il
        INNER JOIN instances i
            ON i.id = il.instanceId
        WHERE i.fullName = ?
        `;
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        const rows = await conn.Select<InstanceLogOverviewData>(query, fullInstanceName);

        return rows;
    }
}