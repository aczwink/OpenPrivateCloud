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
import ssh2 from "ssh2";
import { Property } from "acts-util-core";
import { GlobalInjector } from "acts-util-node";
import { ShellInterface, ShellWrapper } from "./ShellWrapper";
import { HostsManager } from "../../services/HostsManager";

const colorCodeRegEx = new RegExp("\x1B\[[0-9;?]*[a-zA-Z]");
const bashPrompt = new RegExp("[a-z\-]+@[a-z\-]+:~\\$ $");

export class SSHShellWrapper implements ShellWrapper
{
    constructor(private channel: ssh2.ClientChannel, private hostId: number)
    {
        this.standardPromptCounter = new Property(false);
        this.channel.stdout.on("data", this.OnNewChannelData.bind(this));
    }

    //Public methods
    public Close(): Promise<void>
    {
        const promise = new Promise<void>( resolve => {
            this.channel.on("exit", resolve);
        });
        this.channel.end("exit\n");
        
        return promise;
    }

    public RegisterForDataEvents(callback?: (data: string) => void): void
    {
        this.dataCallback = callback;
    }

    public SendInput(data: string): void
    {
        this.channel.write(data, "utf-8");
    }

    public async StartCommand(command: string[]): Promise<void>
    {
        if(command[0] === "sudo")
        {
            command.splice(1, 0, 'PS1="$ "', "--stdin");
        }

        const cmdLine = command.join(" ");
        this.channel.write(cmdLine + "\n", "utf-8");

        if(command[0] === "sudo")
        {
            await new Promise( resolve => {
                setTimeout(resolve, 300);
            }); //wait for sudo prompt
            const hm = GlobalInjector.Resolve(HostsManager);
            const creds = await hm.QueryHostCredentials(this.hostId);
            this.channel.write(creds!.password + "\n");
        }
    }

    public async WaitForCommandToFinish(): Promise<void>
    {
        await this.WaitForStandardPrompt();
    }

    public WaitForStandardPrompt()
    {
        return new Promise<void>( resolve => {
            let resolved = false;

            const subscription = this.standardPromptCounter.Subscribe(newValue => {
                if(newValue && !resolved)
                {
                    resolved = true;
                    this.standardPromptCounter.Set(false);

                    setTimeout( () => subscription.Unsubscribe(), 10);
                    
                    resolve();
                }
            });
        });
    }

    //Private variables
    private standardPromptCounter: Property<boolean>;
    private dataCallback?: (data: string) => void;

    //Event handlers
    private OnNewChannelData(data: string)
    {
        const bashMatch = data.match(bashPrompt);
        if(bashMatch !== null)
        {
            this.standardPromptCounter.Set(true);
            const remaining = data.substring(0, data.length - bashMatch[0].length);

            const colMatch = remaining.match(colorCodeRegEx);
            if( (colMatch !== null) && (remaining === colMatch[0]))
                return;

            this.dataCallback?.call(undefined, remaining);
            return;
        }

        const colMatch = data.match(colorCodeRegEx);
        if( (colMatch !== null) && (data === colMatch[0]))
            return;

        if(data.endsWith("$ "))
        {
            this.standardPromptCounter.Set(true);
            const remaining = data.substring(0, data.length - 2);

            this.dataCallback?.call(undefined, remaining);
        }
        else
            this.dataCallback?.call(undefined, data);
    }
}



export class SSHShellInterface implements ShellInterface
{
    constructor(private channel: ssh2.ClientChannel)
    {
        channel.stderr.setEncoding("utf-8");
        channel.stderr.on("data", chunk => process.stderr.write(chunk));
    }

    //Public methods
    public Exit(): Promise<void>
    {
        const promise = new Promise<void>( resolve => {
            this.channel.on("exit", resolve);
        });
        this.channel.end("exit\n");
        
        return promise;
    }

    public RegisterStdOutListener(callback: (data: string) => void): void
    {
        this.channel.stdout.setEncoding("utf-8");
        this.channel.stdout.on("data", callback);
    }

    public SendInput(data: string): void
    {
        this.channel.write(data, "utf-8");
    }
}