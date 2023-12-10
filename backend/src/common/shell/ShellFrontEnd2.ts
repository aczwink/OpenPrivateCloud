/**
 * OpenPrivateCloud
 * Copyright (C) 2023 Amir Czwink (amir130@hotmail.de)
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
import { GlobalInjector } from "acts-util-node";
import { HostsManager } from "../../services/HostsManager";
import { Subject } from "acts-util-core";
import { ShellInterface } from "./ShellWrapper";
import { ProcessTracker, ProcessTrackerManager } from "../../services/ProcessTrackerManager";

export const g_PS1 = "~OPC~";

enum EventType
{
    Line,
    NewData,
    StandardPrompt,
}

interface DataLessShellEvent
{
    type: EventType.NewData | EventType.StandardPrompt,
};

interface LineShellEvent
{
    type: EventType.Line;
    line: string;
}

type ShellEvent = DataLessShellEvent | LineShellEvent;

export class ShellFrontend2
{
    constructor(private shellInterface: ShellInterface, private hostId: number)
    {
        this.buffer = "";
        this.eventStream = new Subject<ShellEvent>();
        this.trackers = [];

        this.shellInterface.RegisterStdOutListener(this.OnNewChannelData.bind(this));
    }

    //Public methods
    public BufferDataUntilCommandEnds()
    {
        const context = this;
        const lines: string[] = [];
        return new Promise<string>( resolve => {
            const subscription = this.eventStream.Subscribe({
                next(data)
                {
                    switch(data.type)
                    {
                        case EventType.Line:
                            lines.push(data.line);
                            break;
                        case EventType.StandardPrompt:
                            subscription.Unsubscribe();
                            context.TerminateCurrentTracker();
                            resolve(lines.join("\n"));
                            break;
                    }
                },
            });
        });
    }

    public async ExecuteCommand(command: string[])
    {
        await this.IssueCommand(command);
        await this.WaitForCommandToFinish();
    }

    public async ExitSession()
    {
        while(this.trackers.length > 0)
            this.trackers.pop()?.Fail("Shell closed");
        await this.shellInterface.Exit();
    }

    public Expect(line: string)
    {
        const context = this;
        return new Promise<void>( resolve => {
            const subscription = this.eventStream.Subscribe({
                next(data)
                {
                    switch(data.type)
                    {
                        case EventType.Line:
                        case EventType.NewData:
                            if(context.buffer === line)
                            {
                                subscription.Unsubscribe();
                                context.buffer = "";
                                resolve();
                            }
                            break;
                    }
                },
            });
        });
    }

    public async ExpectRegEx(regEx: RegExp)
    {
        const context = this;
        return new Promise<void>( resolve => {
            const subscription = this.eventStream.Subscribe({
                next(data)
                {
                    switch(data.type)
                    {
                        case EventType.NewData:
                            if(regEx.test(context.buffer))
                            {
                                subscription.Unsubscribe();
                                resolve();
                            }
                            break;
                        case EventType.Line:
                            break;
                    }
                },
            });
        });
    }
    
    public async IssueCommand(command: string[])
    {
        if(command[0] === "sudo")
        {
            command.splice(1, 0, 'PS1="' + g_PS1 + '"', "--stdin");
        }

        const cmdLine = command.join(" ");
        const processTrackerManager = GlobalInjector.Resolve(ProcessTrackerManager);
        const tracker = await processTrackerManager.Create(this.hostId, cmdLine);
        this.trackers.push(tracker);

        this.shellInterface.SendInput(cmdLine + "\n");

        if(command[0] === "sudo")
        {
            await this.ExpectRegEx(/\[sudo\] .+ opc-hu: /);
            const hm = GlobalInjector.Resolve(HostsManager);
            const creds = await hm.QueryHostCredentials(this.hostId);
            this.shellInterface.SendInput(creds!.password + "\n");
        }
    }

    public SendInputLine(line: string)
    {
        this.shellInterface.SendInput(line + "\n");
    }

    public async WaitForCommandToFinish()
    {
        await this.WaitForStandardPrompt();

        //this.shellInterface.SendInput("echo $?\n");
        //TODO: implement exit code tracking

        await this.TerminateCurrentTracker();
    }

    public WaitForStandardPrompt()
    {
        return new Promise<void>( resolve => {
            const subscription = this.eventStream.Subscribe({
                next(data)
                {
                    if(data.type === EventType.StandardPrompt)
                    {
                        subscription.Unsubscribe();
                        resolve();
                    }
                },
            });
        });
    }

    //Private state
    private buffer: string;
    private eventStream: Subject<ShellEvent>;
    private trackers: ProcessTracker[];

    //Private methods
    private LogString(data: string)
    {
        const tracker = this.trackers[this.trackers.length-1];
        tracker?.Add(data);
    }

    private ParseBuffer()
    {
        while(true)
        {
            const idx = this.buffer.indexOf("\n");
            if(idx === -1)
                break;
            const line = this.buffer.substring(0, idx);
            this.buffer = this.buffer.substring(idx+1);

            this.eventStream.Next({
                type: EventType.Line,
                line: line.trim()
            });
        }

        if(this.buffer.endsWith(g_PS1))
        {
            this.buffer = this.buffer.substring(0, this.buffer.length - g_PS1.length);
            this.eventStream.Next({
                type: EventType.StandardPrompt,
            });
        }
    }

    private async TerminateCurrentTracker()
    {
        const tracker = this.trackers.pop();
        tracker?.Finish();
    }

    //Event handlers
    private OnNewChannelData(data: string)
    {
        this.LogString(data);

        this.buffer += data;
        this.eventStream.Next({
            type: EventType.NewData,
        });
        this.ParseBuffer();
    }
}