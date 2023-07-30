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
import path from "path";
import { Injectable } from "acts-util-node";
import { RemoteFileSystemManager } from "../../services/RemoteFileSystemManager";
import { LightweightResourceReference } from "../../common/ResourceReference";
import { HostNetworkInterfaceCardsManager } from "../../services/HostNetworkInterfaceCardsManager";
import { DNS_ServerSettings, DNS_Zone } from "./models_dns";
import { SystemServicesManager } from "../../services/SystemServicesManager";
import { RemoteRootFileSystemManager } from "../../services/RemoteRootFileSystemManager";
import { ModulesManager } from "../../services/ModulesManager";
import { ResourceStateResult } from "../ResourceProvider";

@Injectable
export class dnsmasqManager
{
    constructor(private remoteFileSystemManager: RemoteFileSystemManager, private hostNetworkInterfaceCardsManager: HostNetworkInterfaceCardsManager, private systemServicesManager: SystemServicesManager,
        private remoteRootFileSystemManager: RemoteRootFileSystemManager, private modulesManager: ModulesManager)
    {
    }

    //Public methods
    public async QueryResourceState(resourceReference: LightweightResourceReference): Promise<ResourceStateResult>
    {
        const running = await this.systemServicesManager.IsServiceActive(resourceReference.hostId, "dnsmasq");
        if(running)
            return "running";
        return "down";
    }

    public async UnlinkConfig(resourceReference: LightweightResourceReference)
    {
        const configFileName = this.DeriveConfigFileName(resourceReference);
        const configPathInDnsMasqDir = "/etc/dnsmasq.d/" + configFileName;

        await this.remoteRootFileSystemManager.RemoveFile(resourceReference.hostId, configPathInDnsMasqDir);
    }

    public async WriteConfigFile(resourceReference: LightweightResourceReference, serverSettings: DNS_ServerSettings, zones: DNS_Zone[], configDir: string)
    {
        const nic = await this.hostNetworkInterfaceCardsManager.FindExternalNetworkInterface(resourceReference.hostId);
        const configFilePath = path.join(configDir, "config");
        const hostsPath = path.join(configDir, "hosts");

        const domains = zones.map(x => "domain=" + x.name + "\nlocal=/" + x.name + "/").join("\n");
        const forwarders = serverSettings.forwarders.map(x => "server=" + x).join("\n");

        const config = `
interface=${nic}
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

        await this.remoteFileSystemManager.WriteTextFile(resourceReference.hostId, configFilePath, config.trim());

        const hostsText = this.GenerateHostsConfig(zones);
        await this.remoteFileSystemManager.WriteTextFile(resourceReference.hostId, hostsPath, hostsText);

        const configFileName = this.DeriveConfigFileName(resourceReference);
        const configPathInDnsMasqDir = "/etc/dnsmasq.d/" + configFileName;
        const exists = await this.remoteFileSystemManager.Exists(resourceReference.hostId, configPathInDnsMasqDir);
        if(!exists)
            await this.remoteRootFileSystemManager.CreateSymbolicLink(resourceReference.hostId, configPathInDnsMasqDir, configFilePath);

        await this.modulesManager.EnsureModuleIsInstalled(resourceReference.hostId, "dnsmasq");
        await this.systemServicesManager.RestartService(resourceReference.hostId, "dnsmasq");
    }

    //Private methods
    private DeriveConfigFileName(resourceReference: LightweightResourceReference)
    {
        return "opc-rdnsmasq-" + resourceReference.id;
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