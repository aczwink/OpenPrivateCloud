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
import { ConfigDialect } from "../../common/config/ConfigDialect";
import { ConfigModel } from "../../common/config/ConfigModel";
import { ConfigParser } from "../../common/config/ConfigParser";
import { ConfigWriter } from "../../common/config/ConfigWriter";
import { RemoteCommandExecutor } from "../../services/RemoteCommandExecutor";
import { RemoteRootFileSystemManager } from "../../services/RemoteRootFileSystemManager";
 
@Injectable
export class SysCtlConfService
{
    constructor(private remoteCommandExecutor: RemoteCommandExecutor, private remoteRootFileSystemManager: RemoteRootFileSystemManager)
    {
    }

    //Public methods
    public async IsIPForwardingEnabled(hostId: number)
    {
        const result = await this.remoteCommandExecutor.ExecuteBufferedCommand(["sysctl", "net.ipv4.ip_forward"], hostId);
        if(!result.stdOut.startsWith("net.ipv4.ip_forward = "))
            throw new Error(result.stdOut);
        const left = result.stdOut.substr("net.ipv4.ip_forward = ".length);
        
        return parseInt(left) === 1;
    }

    public async SetIPForwardingState(hostId: number, enabled: boolean)
    {
        const sysCtlConfDialect: ConfigDialect = {
            commentInitiators: ["#"]
        };

        const parser = new ConfigParser(sysCtlConfDialect);
        const entries = await parser.Parse(hostId, "/etc/sysctl.conf");
        const mdl = new ConfigModel(entries);

        mdl.SetProperty("", "net.ipv4.ip_forward", enabled ? 1 : 0);

        const cfgWriter = new ConfigWriter(sysCtlConfDialect, (filePath, content) => this.remoteRootFileSystemManager.WriteTextFile(hostId, filePath, content));
        cfgWriter.Write("/etc/sysctl.conf", entries);

        await this.remoteCommandExecutor.ExecuteCommand({
            source: ["echo", enabled ? "1" : "0"],
            target: ["/proc/sys/net/ipv4/ip_forward"],
            type: "redirect-stdout",
            sudo: true
        }, hostId);

        return {};
    }
}