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

import { Dictionary } from "acts-util-core";
import { Injectable } from "acts-util-node";
import { TimeSchedule } from "../common/TimeSchedule";
import { TaskScheduler } from "./TaskScheduler";

@Injectable
export class TaskSchedulingManager
{
    constructor(private taskScheduler: TaskScheduler)
    {
        this.scheduled = {};
    }

    //Public methods
    public ScheduleForInstance(fullInstanceName: string, lastScheduleTime: Date, schedule: TimeSchedule, task: () => void)
    {
        const oldTaskId = this.scheduled[fullInstanceName];
        if(oldTaskId !== undefined)
            this.taskScheduler.Stop(oldTaskId);
        this.scheduled[fullInstanceName] = this.taskScheduler.ScheduleWithOverdueProtection(lastScheduleTime, schedule, task);
    }

    //Private variables
    private scheduled: Dictionary<number>;
}