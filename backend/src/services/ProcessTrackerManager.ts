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

export interface ProcessTracker
{
    readonly fullText: string;
    readonly startTime: Date;

    Add(...text: string[]): void;
}

class ProcessTrackerImpl implements ProcessTracker
{
    constructor()
    {
        this._startTime = new Date;
        this.entries = [];
    }

    //Properties
    public get fullText()
    {
        return this.entries.Values().Map(x => x.timeStamp.toISOString() + ": " + x.text).Join("\n");
    }

    public get startTime(): Date
    {
        return this._startTime;
    }

    //Public methods
    public Add(...text: string[])
    {
        this.entries.push({
            text: text.join(" "),
            timeStamp: new Date()
        });
    }

    //Private variables
    private _startTime: Date;
    private entries: { timeStamp: Date; text: string; }[];
}

@Injectable
export class ProcessTrackerManager
{
    //Public methods
    public Create(): ProcessTracker
    {
        return new ProcessTrackerImpl;
    }
}