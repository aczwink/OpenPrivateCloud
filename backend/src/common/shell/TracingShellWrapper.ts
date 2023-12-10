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

import { ProcessTracker, ProcessTrackerManager } from "../../services/ProcessTrackerManager";
import { ShellWrapper } from "./ShellWrapper";

export class TracingShellWrapper implements ShellWrapper
{
    constructor(private shellWrapper: ShellWrapper, private hostId: number, private processTrackerManager: ProcessTrackerManager)
    {
        this.trackers = [];
    }

    //Public methods
    public async Close(): Promise<void>
    {
        await this.shellWrapper.Close();
    }
    
    public RegisterForDataEvents(callback?: ((data: string) => void) | undefined): void
    {
        this.shellWrapper.RegisterForDataEvents(newData => {
            this.LogString(newData);
            if(callback !== undefined)
                callback(newData);
        });
    }

    public async StartCommand(command: string[]): Promise<void>
    {
        const tracker = await this.processTrackerManager.Create(this.hostId, command.join(" "));
        this.trackers.push(tracker);

        await this.shellWrapper.StartCommand(command);
    }
    
    public SendInput(data: string): void
    {
        this.shellWrapper.SendInput(data);

        this.LogString(data);
    }

    public async WaitForCommandToFinish(): Promise<void>
    {
        await this.shellWrapper.WaitForCommandToFinish();

        const tracker = this.trackers.pop();
        tracker?.Finish();
    }

    public async WaitForStandardPrompt(): Promise<void>
    {
        await this.shellWrapper.WaitForStandardPrompt();
    }

    //Private variables
    private trackers: ProcessTracker[];

    //Private methods
    private LogString(data: string)
    {
        const tracker = this.trackers[this.trackers.length-1];
        tracker?.Add(data);
    }
}