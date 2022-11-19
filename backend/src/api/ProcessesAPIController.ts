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

import { APIController, Get, NotFound, Query } from "acts-util-apilib";
import { ProcessTrackerManager } from "../services/ProcessTrackerManager";

interface ProcessDto
{
    id: number;
    startTime: Date;
    status: number;
    title: string;
}

@APIController("processes")
class ProcessesAPIController
{
    constructor(private processTrackerManager: ProcessTrackerManager)
    {
    }

    @Get()
    public QueryProcesses()
    {
        return this.processTrackerManager.processes.Map(x => {
            const res: ProcessDto = {
                id: x.id,
                startTime: x.startTime,
                status: x.status,
                title: x.title
            };
            return res;
        }).ToArray();
    }

    @Get("info")
    public QueryProcessText(
        @Query processId: number
    )
    {
        const tracker = this.processTrackerManager.RequestTracker(processId);
        if(tracker === undefined)
            return NotFound("process tracker not found");
        return tracker;
    }
}