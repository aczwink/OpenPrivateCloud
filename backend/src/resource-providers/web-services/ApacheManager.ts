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

import { EnumeratorBuilder } from "acts-util-core/dist/Enumeration/EnumeratorBuilder";
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

    public async DisablePort(hostId: number, port: number)
    {
        const ports = await this.ReadPortsFile(hostId);
        const portsSet = ports.Values().ToSet();
        portsSet.delete(port);

        await this.WritePortsFile(hostId, portsSet.Values());
    }

    public async DisableSite(hostId: number, name: string)
    {
        await this.remoteCommandExecutor.ExecuteCommand(["sudo", "a2dissite", name], hostId);
    }

    public async EnableModule(hostId: number, name: string)
    {
        await this.remoteCommandExecutor.ExecuteCommand(["sudo", "a2enmod", name], hostId);
    }

    public async EnablePort(hostId: number, port: number)
    {
        const ports = await this.ReadPortsFile(hostId);
        const newPorts = ports.Values().ToSet().add(port);

        await this.WritePortsFile(hostId, newPorts.Values());
    }

    public async EnableSite(hostId: number, name: string)
    {
        await this.remoteCommandExecutor.ExecuteCommand(["sudo", "a2ensite", name], hostId);
    }

    public async QueryModules(hostId: number)
    {
        return this.QueryEntities("mods", hostId);
    }

    public async QuerySite(hostId: number, siteName: string)
    {
        const data = await this.remoteFileSystemManager.ReadTextFile(hostId, "/etc/apache2/sites-available/" + siteName + ".conf");

        const cp = new ApacheConfigParser(data);
        return cp.Parse();
    }

    public async QuerySites(hostId: number)
    {
        return this.QueryEntities("sites", hostId);
    }

    public async SetSite(hostId: number, siteName: string, vHost: VirtualHost)
    {
        await this.remoteRootFileSystemManager.WriteTextFile(hostId, "/etc/apache2/sites-available/" + siteName + ".conf", vHost.ToConfigString());
    }

    //Private methods
    private async QueryEntities(dirPrefix: string, hostId: number)
    {
        const files = await this.remoteFileSystemManager.ListDirectoryContents(hostId, "/etc/apache2/" + dirPrefix + "-available/");
        const entities: EntityInfo[] = [];
        for (const fileName of files)
        {
            if(!fileName.endsWith(".conf"))
                continue;

            const modName = fileName.substring(0, fileName.lastIndexOf("."));
            const enabled = await this.remoteFileSystemManager.Exists(hostId, "/etc/apache2/" + dirPrefix + "-enabled/" + fileName);
            
            entities.push({ name: modName, enabled });
        }
        return entities;
    }

    private async ReadPortsFile(hostId: number)
    {
        const data = await this.remoteFileSystemManager.ReadTextFile(hostId, "/etc/apache2/ports.conf");
        const lines = data.split("\n");

        const ports = [];
        for (const line of lines)
        {
            const trimmed = line.trim();
            if( trimmed.startsWith("#") || (trimmed.length === 0) )
                continue;
            ports.push(parseInt(trimmed.split(" ")[1]));
        }
        return ports;
    }

    private async WritePortsFile(hostId: number, ports: EnumeratorBuilder<number>)
    {
        const data = ports.OrderBy(x => x).Map(x => "Listen " + x).Join("\n");
        await this.remoteRootFileSystemManager.WriteTextFile(hostId, "/etc/apache2/ports.conf", data);
    }
}