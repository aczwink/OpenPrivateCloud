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

import { Injectable } from "acts-util-node";
import { TimeSchedule } from "../common/TimeSchedule";

interface Task
{
    nextScheduleTime: Date;
    task: () => void;
    timerId: NodeJS.Timeout;
}

/**
 * As soon as tasks are sucessfully dispatched, they can't be stopped anymore and any reference to it are lost.
 */
@Injectable
export class TaskScheduler
{
    constructor()
    {
        this.taskCounter = 0;
        this.tasks = new Map<number, Task>();
    }

    //Public methods
    public ScheduleAfterHours(n: number, task: () => void)
    {
        const oneHour = 60 * 60 * 1000;
        const next = Date.now() + n * oneHour;
        return this.ScheduleAtTimeOrNow(new Date(next), task);
    }

    public ScheduleWithOverdueProtection(lastScheduleTime: Date, schedule: TimeSchedule, task: () => void)
    {
        //the overdue protection is inspired by anacron. When a task is overdue, it is scheduled immediately

        const oneDay = 24 * 60 * 60 * 1000;
        const oneWeek = 7 * oneDay;

        switch(schedule.type)
        {
            case "daily":
            {
                const day = lastScheduleTime.getUTCDate() + (lastScheduleTime.getUTCHours() < schedule.atHour ? 0 : 1);
                const nextScheduleTime = new Date(lastScheduleTime.getUTCFullYear(), lastScheduleTime.getUTCMonth(), day, schedule.atHour, Math.random() * 60, 0, 0);

                return this.ScheduleAtTimeOrNow(nextScheduleTime, task);
            }
            break;
            case "weekly":
            {
                const next = lastScheduleTime.valueOf() + oneWeek * schedule.counter;
                return this.ScheduleAtTimeOrNow(new Date(next), task);
            }
            break;
        }
    }

    public Stop(taskId: number)
    {
        const task = this.tasks.get(taskId);

        if(task !== undefined) //task may have been dispatched already
        {
            clearTimeout(task.timerId);
            this.tasks.delete(taskId);
        }
    }

    //Private variables
    private taskCounter: number;
    private tasks: Map<number, Task>;

    //Private methods
    private ComputeDelay(scheduleTime: Date)
    {
        let diff = scheduleTime.valueOf() - Date.now();
        if(diff < 0)
            diff = 0;

        const timeOutMax = 2147483647; //values higher than this cause setTimeout to fail
        if(diff > timeOutMax)
            diff = timeOutMax;

        return diff;
    }

    private ComputeNextScheduleTime(referenceDate: Date, interval: number)
    {
        const d = new Date( referenceDate.valueOf() + interval );
        if(d.valueOf() < Date.now())
            return new Date();
        return d;
    }

    private ScheduleAtTimeOrNow(startTime: Date, task: () => void)
    {
        const taskNumber = this.taskCounter++;

        const nextScheduleTime = this.ComputeNextScheduleTime(startTime, 0);
        this.tasks.set(taskNumber, {
            nextScheduleTime: nextScheduleTime,
            task,
            timerId: this.StartClock(taskNumber, nextScheduleTime),
        });

        return taskNumber;
    }

    private StartClock(taskId: number, nextScheduleTime: Date)
    {
        return setTimeout(this.OnSchedulerInterrupt.bind(this, taskId), this.ComputeDelay(nextScheduleTime));
    }

    //Event handlers
    private async OnSchedulerInterrupt(taskId: number)
    {
        let task = this.tasks.get(taskId);
        if(task === undefined)
            return; //task was already stopped
        if(task.nextScheduleTime.valueOf() > Date.now())
        {
            //clock came to early, reschedule
            task.timerId = this.StartClock(taskId, task.nextScheduleTime);
            return;
        }

        task.task();
        this.tasks.delete(taskId);
    }
}