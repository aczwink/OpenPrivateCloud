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
import { HostsController } from "../data-access/HostsController";
import { ShellWrapper } from "./ShellWrapper";

export class SSHShellWrapper implements ShellWrapper
{
    constructor(private channel: ssh2.ClientChannel, private hostId: number)
    {
        this.standardPromptCounter = new Property(false);
        this.channel.stdout.on("data", this.OnNewChannelData.bind(this));
    }

    //Public methods
    public async ChangeDirectory(targetDirectory: string): Promise<void>
    {
        this.channel.write("cd " + targetDirectory + "\n");

        await this.WaitForStandardPrompt();
    }

    public async ChangeUser(linuxUserName: string): Promise<void>
    {
        await this.StartCommand(["sudo", "-i", "-u", linuxUserName]);
        await this.WaitForStandardPrompt();
    }

    public Close(): Promise<void>
    {
        this.channel.end("exit\n");
        return new Promise<void>( resolve => this.channel.on("exit", resolve) );
    }

    public async ExecuteCommand(command: string[]): Promise<void>
    {
        await this.StartCommand(command);
        await this.WaitForCommandToFinish();
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
            command.splice(1, 0, "--stdin");
        }

        const cmdLine = command.join(" ");
        this.channel.write(cmdLine + "\n", "utf-8");

        if(command[0] === "sudo")
        {
            await new Promise( resolve => {
                setTimeout(resolve, 300);
            }); //wait for sudo prompt
            const hc = GlobalInjector.Resolve(HostsController);
            const creds = await hc.RequestHostCredentials(this.hostId);
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
            const subscription = this.standardPromptCounter.Subscribe(newValue => {
                if(newValue)
                {
                    subscription.Unsubscribe();
                    this.standardPromptCounter.Set(false);
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
        if(data.endsWith("$ "))
        {
            this.standardPromptCounter.Set(true);

            this.dataCallback?.call(undefined, data.substring(0, data.length - 2));
        }
        else
            this.dataCallback?.call(undefined, data);
    }
}