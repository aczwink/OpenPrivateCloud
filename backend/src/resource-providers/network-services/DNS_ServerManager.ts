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
import { DNS_ServerProperties } from "./properties";
import { DeploymentContext, ResourceState } from "../ResourceProvider";
import { DockerContainerConfig, DockerManager } from "../compute-services/DockerManager";
import { LightweightResourceReference } from "../../common/ResourceReference";
import { ResourceConfigController } from "../../data-access/ResourceConfigController";
import { ResourcesManager } from "../../services/ResourcesManager";
import { RemoteFileSystemManager } from "../../services/RemoteFileSystemManager";
import { EqualsAny } from "acts-util-core";

interface DNS_A_Record
{
    type: "A";
    name: string;
    target: string;
}

interface DNS_NS_Record
{
    type: "NS";
    name: string;
}

interface DNS_SOA_Record
{
    type: "SOA";
    serialNumber: number;
    /**
     * in seconds
     */
    refreshTime: number;
    /**
     * in seconds
     */
    retryTime: number;
    /**
     * in seconds
     */
    expiryTime: number;
    /**
     * in seconds
     */
    minTTL: number;
}

export type DNS_Record = DNS_A_Record | DNS_NS_Record | DNS_SOA_Record;

interface DNS_Zone
{
    name: string;
    records: DNS_Record[];
}

interface DNS_ServerConfig
{
    forwarders: string[];
    zones: DNS_Zone[];
}

@Injectable
export class DNS_ServerManager
{
    constructor(private dockerManager: DockerManager, private resourceConfigController: ResourceConfigController, private resourcesManager: ResourcesManager, private remoteFileSystemManager: RemoteFileSystemManager)
    {
    }
    
    //Public methods
    public async AddZone(resourceReference: LightweightResourceReference, zoneName: string)
    {
        const config = await this.ReadConfig(resourceReference.id);
        config.zones.push({
            name: zoneName,
            records: [
                {
                    type: "SOA",
                    serialNumber: 1,
                    refreshTime: 3600,
                    retryTime: 300,
                    expiryTime: 2419200, //4 weeks
                    minTTL: 10,
                },
                {
                    type: "NS",
                    name: "ns1"
                },
                {
                    type: "A",
                    name: "ns1",
                    target: "0.0.0.0"
                }
            ]
        });
        await this.resourceConfigController.UpdateOrInsertConfig(resourceReference.id, config);

        this.UpdateBindState(resourceReference);
    }

    public async AddZoneRecord(resourceReference: LightweightResourceReference, zoneName: string, record: DNS_Record)
    {
        const config = await this.ReadConfig(resourceReference.id);
        const zone = config.zones.find(x => x.name === zoneName);
        if(zone === undefined)
            return false;

        zone.records.push(record);

        await this.resourceConfigController.UpdateOrInsertConfig(resourceReference.id, config);
        this.UpdateBindState(resourceReference);

        return true;
    }

    public async DeleteResource(resourceReference: LightweightResourceReference)
    {
        await this.DestroyContainer(resourceReference);

        await this.resourcesManager.RemoveResourceStorageDirectory(resourceReference);
    }

    public async DeleteZone(resourceReference: LightweightResourceReference, zoneName: string)
    {
        const config = await this.ReadConfig(resourceReference.id);

        const idx = config.zones.findIndex(x => x.name === zoneName);
        config.zones.Remove(idx);

        await this.resourceConfigController.UpdateOrInsertConfig(resourceReference.id, config);

        const fileName = zoneName + ".zone";
        const paths = this.BuildPaths(resourceReference);
        await this.remoteFileSystemManager.UnlinkFile(resourceReference.hostId, path.join(paths.configDir, fileName));

        this.UpdateBindState(resourceReference);
    }

    public async DeleteZoneRecord(resourceReference: LightweightResourceReference, zoneName: string, record: DNS_Record)
    {
        const config = await this.ReadConfig(resourceReference.id);
        const zone = config.zones.find(x => x.name === zoneName);
        if(zone === undefined)
            return false;

        const idx = zone.records.findIndex(x => EqualsAny(x, record));
        zone.records.Remove(idx);

        await this.resourceConfigController.UpdateOrInsertConfig(resourceReference.id, config);
        this.UpdateBindState(resourceReference);

        return true;
    }

    public async EditZoneRecord(resourceReference: LightweightResourceReference, zoneName: string, recordIndex: number, record: DNS_Record)
    {
        const config = await this.ReadConfig(resourceReference.id);
        const zone = config.zones.find(x => x.name === zoneName);
        if(zone === undefined)
            return false;

        zone.records[recordIndex] = record;

        await this.resourceConfigController.UpdateOrInsertConfig(resourceReference.id, config);
        this.UpdateBindState(resourceReference);

        return true;
    }

    public async ProvideResource(instanceProperties: DNS_ServerProperties, context: DeploymentContext)
    {
        await this.resourcesManager.CreateResourceStorageDirectory(context.resourceReference);
        const paths = this.BuildPaths(context.resourceReference);

        await this.remoteFileSystemManager.CreateDirectory(context.hostId, paths.configDir);

        this.UpdateBindState(context.resourceReference);
    }

    public async QueryResourceState(resourceReference: LightweightResourceReference): Promise<ResourceState>
    {
        const containerName = this.DeriveContainerName(resourceReference);
        const containerInfo = await this.dockerManager.InspectContainer(resourceReference.hostId, containerName);
        if(containerInfo === undefined)
            return "in deployment";

        switch(containerInfo.State.Status)
        {
            case "created":
            case "restarting":
                return "in deployment";
            case "exited":
                return "down";
            case "running":
                return "running";
        }
    }

    public async QueryZone(resourceReference: LightweightResourceReference, zoneName: string)
    {
        const config = await this.ReadConfig(resourceReference.id);
        return config.zones.find(x => x.name === zoneName);
    }

    public async QueryZones(resourceReference: LightweightResourceReference)
    {
        const config = await this.ReadConfig(resourceReference.id);

        return config.zones;
    }

    //Private methods
    private BuildPaths(resourceReference: LightweightResourceReference)
    {
        const resourceDir = this.resourcesManager.BuildResourceStoragePath(resourceReference);

        return {
            configDir: path.join(resourceDir, "config")
        };
    }

    private DeriveContainerName(resourceReference: LightweightResourceReference)
    {
        return "opc-rdnssrv-" + resourceReference.id;
    }

    private async DestroyContainer(resourceReference: LightweightResourceReference)
    {
        const containerName = this.DeriveContainerName(resourceReference);
        const containerInfo = await this.dockerManager.InspectContainer(resourceReference.hostId, containerName);
        if(containerInfo === undefined)
            return;

        if(containerInfo.State.Running)
            await this.dockerManager.StopContainer(resourceReference.hostId, containerName);

        await this.dockerManager.DeleteContainer(resourceReference.hostId, containerName);
    }

    private GenerateBindConfigFile(config: DNS_ServerConfig)
    {
        const forwarderIPs = config.forwarders.Values().Map(x => x + ";").Join("\n");
        const zones = config.zones.map(x => `
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
${zones}
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

    private async ReadConfig(resourceId: number): Promise<DNS_ServerConfig>
    {
        const config = await this.resourceConfigController.QueryConfig<DNS_ServerConfig>(resourceId);
        if(config === undefined)
        {
            return {
                forwarders: ["1.1.1.1", "1.0.0.1"], //cloudflares dns servers
                zones: []
            };
        }
        return config;
    }

    private async RestartContainer(resourceReference: LightweightResourceReference)
    {
        await this.DestroyContainer(resourceReference);

        const paths = this.BuildPaths(resourceReference);

        const config: DockerContainerConfig = {
            env: [
            ],
            imageName: "ubuntu/bind9:latest",
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
            restartPolicy: "always",
            volumes: [
                {
                    containerPath: "/etc/bind",
                    hostPath: paths.configDir,
                    readOnly: true
                }
            ]
        };
        const containerName = this.DeriveContainerName(resourceReference);
        await this.dockerManager.CreateContainerInstanceAndStart(resourceReference.hostId, containerName, config);
    }

    private async UpdateBindState(resourceReference: LightweightResourceReference)
    {
        await this.WriteBindConfigFile(resourceReference);
        await this.RestartContainer(resourceReference);
    }

    private async WriteBindConfigFile(resourceReference: LightweightResourceReference)
    {
        const config = await this.ReadConfig(resourceReference.id);
        const paths = this.BuildPaths(resourceReference);

        for (const zone of config.zones)
        {
            const zoneData = this.GenerateZoneFile(zone);
            const fileName = zone.name + ".zone";
            await this.remoteFileSystemManager.WriteTextFile(resourceReference.hostId, path.join(paths.configDir, fileName), zoneData.trim());
        }
        const namedConf = this.GenerateBindConfigFile(config);

        await this.remoteFileSystemManager.WriteTextFile(resourceReference.hostId, path.join(paths.configDir, "named.conf"), namedConf.trim());
    }
}