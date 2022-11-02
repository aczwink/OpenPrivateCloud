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
import { RemoteCommandExecutor } from "../../services/RemoteCommandExecutor";

type VMState = "running" | "shut off";

@Injectable
export class VirtualMachineManager
{
    constructor(private remoteCommandExecutor: RemoteCommandExecutor)
    {
    }

    //Public methods
    public async DeleteVM(hostId: number, instanceName: string)
    {
        await this.remoteCommandExecutor.ExecuteCommand(["virsh", "--connect", "qemu:///system", "undefine", "--domain", instanceName], hostId);
    }

    public async ExecuteAction(hostId: number, instanceName: string, action: "destroy" | "start" | "shutdown")
    {
        const command = ["virsh", "--connect", "qemu:///system"];
        switch(action)
        {
            case "destroy":
                command.push("destroy", instanceName, "--graceful");
                break;
            case "shutdown":
            case "start":
                command.push(action, instanceName);
                break;
        }
        await this.remoteCommandExecutor.ExecuteCommand(command, hostId);
    }

    public async QueryVMState(hostId: number, instanceName: string): Promise<VMState>
    {
        const { stdOut } = await this.remoteCommandExecutor.ExecuteBufferedCommand(["virsh", "--connect", "qemu:///system", "domstate", "--domain", instanceName], hostId);
        return stdOut.trim() as any;
    }
}