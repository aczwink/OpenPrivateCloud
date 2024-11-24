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

import { Dictionary, ObjectExtensions } from "acts-util-core";
import { DateTime, GlobalInjector, Injectable } from "acts-util-node";
import { HostsController } from "../data-access/HostsController";
import { ErrorService } from "./ErrorService";

enum Status
{
    Running = 0,
    Finished = 1,
    Failed = 2
}

interface ProcessTrackerReadOnly
{
    /**
     * @format multi-line
     */
    readonly fullText: string;
    readonly hostName: string;
    readonly startTime: DateTime;
    readonly status: Status;
    readonly title: string;
}

interface ProcessTrackerReadOnlyWithId extends ProcessTrackerReadOnly
{
    readonly id: number;
}

export interface ProcessTracker extends ProcessTrackerReadOnly
{
    Add(...text: string[]): void;
    Fail(e: unknown): void;
    Finish(): void;
}

class ProcessTrackerImpl implements ProcessTracker
{
    constructor(private _hostName: string, private _title: string, private finalizer: () => void)
    {
        this._startTime = DateTime.Now();
        this._status = Status.Running;
        this.entries = [];
    }

    //Properties
    public get fullText()
    {
        return this.entries.Values().Map(x => x.timeStamp.toISOString() + ": " + x.text).Join("\n");
    }

    public get hostName(): string
    {
        return this._hostName;
    }

    public get startTime(): DateTime
    {
        return this._startTime;
    }

    public get status(): Status
    {
        return this._status;
    }

    public get title(): string
    {
        return this._title;
    }

    //Public methods
    public Add(...text: string[])
    {
        this.entries.push({
            text: text.join(" "),
            timeStamp: new Date()
        });
    }

    public Fail(e: unknown): void
    {
        const data = GlobalInjector.Resolve(ErrorService).ExtractData(e);
        this.Add(...data);
        this._status = Status.Failed;
        this.finalizer();
    }

    public Finish(): void
    {
        this._status = Status.Finished;
        this.finalizer();
    }

    //Private variables
    private _startTime: DateTime;
    private _status: Status;
    private entries: { timeStamp: Date; text: string; }[];
}

@Injectable
export class ProcessTrackerManager
{
    constructor(private hostsController: HostsController)
    {
        this.trackerCounter = 0;
        this.trackers = {};
    }

    //Properties
    public get processes()
    {
        return ObjectExtensions.Entries(this.trackers).Map(kv => {
            const x = kv.value!;
            const res: ProcessTrackerReadOnlyWithId = {
                id: kv.key as number,
                fullText: x.fullText,
                hostName: x.hostName,
                startTime: x.startTime,
                status: x.status,
                title: x.title
            };
            return res;
        });
    }

    //Public methods
    public async Create(hostIdOrHostName: number | string, title: string): Promise<ProcessTracker>
    {
        const id = this.trackerCounter++;

        let hostName;
        if(typeof hostIdOrHostName === "number")
        {
            const host = await this.hostsController.QueryHost(hostIdOrHostName);
            hostName = host!.hostName;
        }
        else
            hostName = hostIdOrHostName;

        const tracker = new ProcessTrackerImpl(hostName, title, this.OnTrackerFinished.bind(this, id));
        this.trackers[id] = tracker;

        return tracker;
    }

    public RequestTracker(processId: number): ProcessTrackerReadOnlyWithId | undefined
    {
        const tracker = this.trackers[processId];
        if(tracker === undefined)
            return undefined;
        return {
            id: processId,
            fullText: tracker.fullText,
            hostName: tracker.hostName,
            startTime: tracker.startTime,
            status: tracker.status,
            title: tracker.title,
        };
    }

    //Private variables
    private trackerCounter: number;
    private trackers: Dictionary<ProcessTracker>;

    //Event handlers
    private OnTrackerFinished(trackerId: number)
    {
        setTimeout(() => {
            delete this.trackers[trackerId];
        }, 60 * 60 * 1000);
    }
}