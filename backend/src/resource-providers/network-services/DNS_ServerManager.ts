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
import { DNS_ServerProperties } from "./properties";
import { DeploymentContext } from "../ResourceProvider";
import { LightweightResourceReference } from "../../common/ResourceReference";
import { ResourceConfigController } from "../../data-access/ResourceConfigController";
import { ResourcesManager } from "../../services/ResourcesManager";
import { RemoteFileSystemManager } from "../../services/RemoteFileSystemManager";
import { EqualsAny } from "acts-util-core";
import { BindContainerManager } from "./BindContainerManager";
import { DNS_Record, DNS_ServerSettings, DNS_Zone } from "./models_dns";
import { DNS_Server_dnsmasqManager } from "./DNS_Server_dnsmasqManager";

interface DNS_ServerConfig
{
    serverSettings: DNS_ServerSettings;
    zones: DNS_Zone[];
}

@Injectable
export class DNS_ServerManager
{
    constructor(private resourceConfigController: ResourceConfigController, private resourcesManager: ResourcesManager, private remoteFileSystemManager: RemoteFileSystemManager,
        private bindContainerManager: BindContainerManager, private dnsmasqManager: DNS_Server_dnsmasqManager)
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

        this.UpdateServerState(resourceReference);
    }

    public async AddZoneRecord(resourceReference: LightweightResourceReference, zoneName: string, record: DNS_Record)
    {
        const config = await this.ReadConfig(resourceReference.id);
        const zone = config.zones.find(x => x.name === zoneName);
        if(zone === undefined)
            return false;

        zone.records.push(record);

        await this.resourceConfigController.UpdateOrInsertConfig(resourceReference.id, config);
        this.UpdateServerState(resourceReference);

        return true;
    }

    public async DeleteResource(resourceReference: LightweightResourceReference)
    {
        const config = await this.ReadConfig(resourceReference.id);
        switch(config.serverSettings.backend)
        {
            case "bind9":
                await this.bindContainerManager.DestroyContainer(resourceReference);
                break;
            case "dnsmasq":
                await this.dnsmasqManager.Stop(resourceReference);
                break;
        }

        await this.resourcesManager.RemoveResourceStorageDirectory(resourceReference);
    }

    public async DeleteZone(resourceReference: LightweightResourceReference, zoneName: string)
    {
        const config = await this.ReadConfig(resourceReference.id);

        const idx = config.zones.findIndex(x => x.name === zoneName);
        config.zones.Remove(idx);

        const paths = this.BuildPaths(resourceReference);
        this.bindContainerManager.ZoneWasRemoved(resourceReference.hostId, zoneName, paths.bindConfigDir);

        await this.UpdateConfig(resourceReference, config);
    }

    public async DeleteZoneRecord(resourceReference: LightweightResourceReference, zoneName: string, record: DNS_Record)
    {
        const config = await this.ReadConfig(resourceReference.id);
        const zone = config.zones.find(x => x.name === zoneName);
        if(zone === undefined)
            return false;

        const idx = zone.records.findIndex(x => EqualsAny(x, record));
        zone.records.Remove(idx);

        await this.UpdateConfig(resourceReference, config);

        return true;
    }

    public async EditZoneRecord(resourceReference: LightweightResourceReference, zoneName: string, existingRecord: DNS_Record, newRecord: DNS_Record)
    {
        const config = await this.ReadConfig(resourceReference.id);
        const zone = config.zones.find(x => x.name === zoneName);
        if(zone === undefined)
            return false;

        const idx = zone.records.findIndex(x => EqualsAny(x, existingRecord));
        zone.records[idx] = newRecord;

        await this.UpdateConfig(resourceReference, config);

        return true;
    }

    public async ProvideResource(instanceProperties: DNS_ServerProperties, context: DeploymentContext)
    {
        const resourceDir = await this.resourcesManager.CreateResourceStorageDirectory(context.resourceReference);
        await this.remoteFileSystemManager.ChangeMode(context.hostId, resourceDir, 0o775); //dnsmasq needs the hosts file to be world-readable
        const paths = this.BuildPaths(context.resourceReference);

        await this.remoteFileSystemManager.CreateDirectory(context.hostId, paths.bindConfigDir);
        await this.remoteFileSystemManager.ChangeMode(context.hostId, paths.bindConfigDir, 0o770);
        await this.remoteFileSystemManager.CreateDirectory(context.hostId, paths.dnsmasqConfigDir);

        this.UpdateServerState(context.resourceReference);
    }

    public async QueryHealthStatus(resourceReference: LightweightResourceReference)
    {
        const config = await this.ReadConfig(resourceReference.id);
        switch(config.serverSettings.backend)
        {
            case "bind9":
                return this.bindContainerManager.QueryHealthStatus(resourceReference);
            case "dnsmasq":
                return this.dnsmasqManager.QueryHealthStatus(resourceReference);
        }
    }

    public async QueryServerSettings(resourceId: number)
    {
        const config = await this.ReadConfig(resourceId);
        return config.serverSettings;
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

    public async UpdateServerSettings(resourceReference: LightweightResourceReference, serverSettings: DNS_ServerSettings)
    {
        const config = await this.ReadConfig(resourceReference.id);

        if(config.serverSettings.backend !== serverSettings.backend)
        {
            switch(config.serverSettings.backend)
            {
                case "bind9":
                    await this.bindContainerManager.DestroyContainer(resourceReference);
                    break;
                case "dnsmasq":
                    await this.dnsmasqManager.Stop(resourceReference);
                    break;
            }
        }

        config.serverSettings = serverSettings;        
        this.UpdateConfig(resourceReference, config);
    }

    //Private methods
    private BuildPaths(resourceReference: LightweightResourceReference)
    {
        const resourceDir = this.resourcesManager.BuildResourceStoragePath(resourceReference);

        return {
            bindConfigDir: path.join(resourceDir, "bind9config"),
            dnsmasqConfigDir: path.join(resourceDir, "dnsmasqconfig")
        };
    }

    private async ReadConfig(resourceId: number): Promise<DNS_ServerConfig>
    {
        const config = await this.resourceConfigController.QueryConfig<DNS_ServerConfig>(resourceId);
        if(config === undefined)
        {
            return {
                serverSettings: {
                    backend: "dnsmasq",
                    forwarders: ["1.1.1.1", "1.0.0.1"], //cloudflares dns servers
                },
                zones: []
            };
        }
        return config;
    }

    private async UpdateConfig(resourceReference: LightweightResourceReference, config: DNS_ServerConfig)
    {
        await this.resourceConfigController.UpdateOrInsertConfig(resourceReference.id, config);
        this.UpdateServerState(resourceReference);
    }

    private async UpdateServerState(resourceReference: LightweightResourceReference)
    {
        const config = await this.ReadConfig(resourceReference.id);
        const paths = this.BuildPaths(resourceReference);

        switch(config.serverSettings.backend)
        {
            case "bind9":
                await this.bindContainerManager.WriteBindConfigFile(resourceReference.hostId, config.serverSettings, config.zones, paths.bindConfigDir);
                await this.bindContainerManager.RestartContainer(resourceReference, paths.bindConfigDir);
                break;
            case "dnsmasq":
                await this.dnsmasqManager.WriteConfigFile(resourceReference, config.serverSettings, config.zones, paths.dnsmasqConfigDir);
                break;
        }
    }
}