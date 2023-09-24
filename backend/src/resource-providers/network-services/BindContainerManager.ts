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
import { LightweightResourceReference } from "../../common/ResourceReference";
import { DNS_Record, DNS_ServerSettings, DNS_Zone } from "./models_dns";
import { RemoteFileSystemManager } from "../../services/RemoteFileSystemManager";
import { DockerContainerConfig } from "../compute-services/DockerManager";
import { ManagedDockerContainerManager } from "../compute-services/ManagedDockerContainerManager";

@Injectable
export class BindContainerManager
{
    constructor(private remoteFileSystemManager: RemoteFileSystemManager, private managedDockerContainerManager: ManagedDockerContainerManager)
    {
    }

    //Public methods
    public async DestroyContainer(resourceReference: LightweightResourceReference)
    {
        await this.managedDockerContainerManager.DestroyContainer(resourceReference);
    }

    public QueryResourceState(resourceReference: LightweightResourceReference)
    {
        return this.managedDockerContainerManager.QueryResourceState(resourceReference);
    }

    public async RestartContainer(resourceReference: LightweightResourceReference, configDir: string)
    {
        throw new Error("TODO: MISSING vnetResourceExternalId, dnsServers");

        const config: DockerContainerConfig = {
            additionalHosts: [],
            capabilities: [],
            dnsSearchDomains: [],
            dnsServers: [], //TODO: set this
            env: [
            ],
            imageName: "ubuntu/bind9:latest",
            macAddress: this.managedDockerContainerManager.CreateMAC_Address(resourceReference.id),
            networkName: "TODO",
            portMap: [
                {
                    containerPort: 53,
                    hostPost: 53,
                    protocol: "TCP"
                },
                {
                    containerPort: 53,
                    hostPost: 53,
                    protocol: "UDP"
                },
            ],
            privileged: false,
            removeOnExit: false,
            restartPolicy: "always",
            volumes: [
                {
                    containerPath: "/etc/bind",
                    hostPath: configDir,
                    readOnly: true
                }
            ],
        };
        await this.managedDockerContainerManager.EnsureContainerIsRunning(resourceReference, config);
    }

    public async WriteBindConfigFile(hostId: number, serverSettings: DNS_ServerSettings, zones: DNS_Zone[], configDir: string)
    {
        for (const zone of zones)
        {
            const zoneData = this.GenerateZoneFile(zone);
            const fileName = zone.name + ".zone";
            await this.remoteFileSystemManager.WriteTextFile(hostId, path.join(configDir, fileName), zoneData.trim());
        }
        const namedConf = this.GenerateBindConfigFile(serverSettings, zones);

        await this.remoteFileSystemManager.WriteTextFile(hostId, path.join(configDir, "named.conf"), namedConf.trim());
    }

    public async ZoneWasRemoved(hostId: number, zoneName: string, configDir: string)
    {
        const fileName = zoneName + ".zone";
        await this.remoteFileSystemManager.UnlinkFile(hostId, path.join(configDir, fileName));
    }

    //Private methods
    private GenerateBindConfigFile(serverSettings: DNS_ServerSettings, zones: DNS_Zone[])
    {
        const forwarderIPs = serverSettings.forwarders.Values().Map(x => x + ";").Join("\n");
        const zonesConf = zones.map(x => `
zone "${x.name}" IN {
    type master;
    file "/etc/bind/${x.name}.zone";
};
        `).join("\n");

        const namedConf = `
options {
    directory "/var/cache/bind";

    forwarders {
        ${forwarderIPs}
    };
};
${zonesConf}
        `;

        return namedConf;
    }

    private GenerateRecordParts(record: DNS_Record)
    {
        switch(record.type)
        {
            case "A":
                return [record.name, "IN", "A", record.target];
            case "NS":
                return ["", "IN", "NS", record.name];
            case "SOA":
            {
                const value = [record.serialNumber, record.refreshTime, record.retryTime, record.expiryTime, record.minTTL];
                return ["@", "IN", "SOA", "ns1", "hostmaster", "( " + value.join(" ") + " )"];
            }
        }
    }
    
    private GenerateZoneFile(zone: DNS_Zone)
    {
        const records = zone.records.Values().Map(this.GenerateRecordParts.bind(this)).Map(x => x.join("\t")).Join("\n");
        return `
$TTL 1h
$ORIGIN ${zone.name}.
${records}
        `;
    }
}