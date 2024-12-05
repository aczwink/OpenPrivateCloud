/**
 * OpenPrivateCloud
 * Copyright (C) 2023-2024 Amir Czwink (amir130@hotmail.de)
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
import path from "path";
import { Injectable } from "acts-util-node";
import { RemoteFileSystemManager } from "../../services/RemoteFileSystemManager";
import { LightweightResourceReference } from "../../common/ResourceReference";
import { HostNetworkInterfaceCardsManager } from "../../services/HostNetworkInterfaceCardsManager";
import { DNS_ServerSettings, DNS_Zone } from "./models_dns";
import { dnsmasqManager } from "./dnsmasqManager";
import { HealthStatus } from "../../data-access/HealthController";
import { ResourcesManager } from "../../services/ResourcesManager";

@Injectable
export class DNS_Server_dnsmasqManager
{
    constructor(private remoteFileSystemManager: RemoteFileSystemManager, private hostNetworkInterfaceCardsManager: HostNetworkInterfaceCardsManager, private dnsmasqManager: dnsmasqManager,
        private resourcesManager: ResourcesManager
    )
    {
    }

    //Public methods
    public async CorrectFileOwnership(resourceReference: LightweightResourceReference, configDir: string)
    {
        const allPaths = [configDir, this.BuildHostsPath(configDir), this.dnsmasqManager.BuildConfigFilePath(configDir)];
        for (const path of allPaths)
            await this.resourcesManager.CorrectResourceStoragePathOwnership(resourceReference, [{ path, recursive: false }]);
    }

    public async QueryHealthStatus(resourceReference: LightweightResourceReference): Promise<HealthStatus>
    {
        const running = await this.dnsmasqManager.IsServiceRunning(resourceReference);
        if(running)
            return HealthStatus.Up;
        return HealthStatus.Down;
    }

    public async Stop(resourceReference: LightweightResourceReference)
    {
        await this.dnsmasqManager.DeleteService(resourceReference);
    }

    public async WriteConfigFile(resourceReference: LightweightResourceReference, serverSettings: DNS_ServerSettings, zones: DNS_Zone[], configDir: string)
    {
        const nic = await this.hostNetworkInterfaceCardsManager.FindExternalNetworkInterface(resourceReference.hostId);
        const hostsPath = this.BuildHostsPath(configDir);

        const domains = zones.map(x => "domain=" + x.name + "\nlocal=/" + x.name + "/").join("\n");
        const forwarders = serverSettings.forwarders.map(x => "server=" + x).join("\n");

        const config = `
no-dhcp-interface=${nic}
bogus-priv
no-hosts
addn-hosts=${hostsPath}
domain-needed
no-resolv
no-poll
${domains}
${forwarders}
        `;

        const hostsText = this.GenerateHostsConfig(zones);
        await this.remoteFileSystemManager.WriteTextFile(resourceReference.hostId, hostsPath, hostsText);
        await this.dnsmasqManager.UpdateService(resourceReference, {
            configDirPath: configDir,
            configContent: config,
            networkInterface: nic,
        });
    }

    //Private methods
    private BuildHostsPath(configDir: string)
    {
        return path.join(configDir, "hosts");
    }

    private GenerateHostsConfig(zones: DNS_Zone[])
    {
        const lines = [];

        for (const zone of zones)
        {
            for (const record of zone.records)
            {
                switch(record.type)
                {
                    case "A":
                        lines.push(record.target + "\t" + record.name + "." + zone.name);
                        break;
                }
            }
        }

        return lines.join("\n");
    }
}