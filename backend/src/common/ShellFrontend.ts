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

import { ShellWrapper } from "./ShellWrapper";

export class ShellFrontend
{
    constructor(private shellWrapper: ShellWrapper)
    {
    }

    //Public methods
    public async ChangeDirectory(targetDirectory: string)
    {
        this.SendInputLine("cd " + targetDirectory);

        await this.shellWrapper.WaitForStandardPrompt();
    }

    public async ChangeUser(linuxUserName: string)
    {
        await this.StartCommand(["sudo", "-i", "-u", linuxUserName]);
        await this.shellWrapper.WaitForStandardPrompt();
    }

    public async Close()
    {
        await this.shellWrapper.Close();
    }

    public async ExecuteCommand(command: string[])
    {
        await this.shellWrapper.StartCommand(command);
        await this.shellWrapper.WaitForCommandToFinish();
    }

    public RegisterForDataEvents(callback?: (data: string) => void)
    {
        this.shellWrapper.RegisterForDataEvents(callback);
    }

    public SendInputLine(line: string)
    {
        this.SendInput(line + "\n");
    }

    public async StartCommand(command: string[])
    {
        await this.shellWrapper.StartCommand(command);
    }

    public async WaitForCommandToFinish()
    {
        await this.shellWrapper.WaitForCommandToFinish();
    }

    //Private methods
    private SendInput(data: string)
    {
        this.shellWrapper.SendInput(data);
    }
}