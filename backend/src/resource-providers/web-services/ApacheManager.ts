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
import { RemoteFileSystemManager } from "../../services/RemoteFileSystemManager";
import { RemoteRootFileSystemManager } from "../../services/RemoteRootFileSystemManager";
import { ApacheConfigParser } from "./ApacheConfigParser";
import { VirtualHost } from "./VirtualHost";

interface EntityInfo
{
    name: string;
    enabled: boolean;
}

@Injectable
export class ApacheManager
{
    constructor(private remoteCommandExecutor: RemoteCommandExecutor, private remoteRootFileSystemManager: RemoteRootFileSystemManager,
        private remoteFileSystemManager: RemoteFileSystemManager)
    {
    }

    //Public methods
    public async CreateSite(hostId: number, name: string, vHost: VirtualHost)
    {
        await this.SetSite(hostId, name, vHost);
    }
    
    public async DeleteSite(hostId: number, name: string)
    {
        await this.remoteRootFileSystemManager.RemoveFile(hostId, "/etc/apache2/sites-available/" + name + ".conf");
    }

    public async DisableModule(hostId: number, name: string)
    {
        await this.remoteCommandExecutor.ExecuteCommand(["sudo", "a2dismod", name], hostId);
    }

    public async DisableSite(hostId: number, name: string)
    {
        await this.remoteCommandExecutor.ExecuteCommand(["sudo", "a2dissite", name], hostId);
    }

    public async EnableModule(hostId: number, name: string)
    {
        await this.remoteCommandExecutor.ExecuteCommand(["sudo", "a2enmod", name], hostId);
    }

    public async EnableSite(hostId: number, name: string)
    {
        await this.remoteCommandExecutor.ExecuteCommand(["sudo", "a2ensite", name], hostId);
    }

    public async QueryModules(hostId: number)
    {
        return this.QueryEntities("mods-available", "-m", hostId);
    }

    public QueryPorts()
    {
        throw new Error("not implemented");
        //return fs.readFileSync("/etc/apache2/ports.conf", "utf-8");
    }

    public async QuerySite(hostId: number, siteName: string)
    {
        const data = await this.remoteFileSystemManager.ReadTextFile(hostId, "/etc/apache2/sites-available/" + siteName + ".conf");

        const cp = new ApacheConfigParser(data);
        return cp.Parse();
    }

    public async QuerySites(hostId: number)
    {
        return this.QueryEntities("sites-available", "-s", hostId);
    }

    public async SetSite(hostId: number, siteName: string, vHost: VirtualHost)
    {
        await this.remoteRootFileSystemManager.WriteTextFile(hostId, "/etc/apache2/sites-available/" + siteName + ".conf", vHost.ToConfigString());
    }

    //Private methods
    private async QueryEntities(dir: string, argSwitch: string, hostId: number)
    {
        const files = await this.remoteFileSystemManager.ListDirectoryContents(hostId, "/etc/apache2/" + dir + "/");
        const entities: EntityInfo[] = [];
        for (const fileEntry of files)
        {
            const fileName = fileEntry.filename;
            if(!fileName.endsWith(".conf"))
                continue;

            const modName = fileName.substring(0, fileName.lastIndexOf("."));
            const exitCode = await this.remoteCommandExecutor.ExecuteCommandWithExitCode(["a2query", argSwitch, fileName], hostId);

            let enabled = exitCode === 0; //0 if enabled, 1 if not
            entities.push({ name: modName, enabled });
        }
        return entities;
    }
}