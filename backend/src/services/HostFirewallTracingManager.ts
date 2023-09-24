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
import ssh2 from "ssh2";
import { Injectable } from "acts-util-node";
import { NumberDictionary, Observer, Subject } from "acts-util-core";
import { RemoteConnectionsManager } from "./RemoteConnectionsManager";
import { SSHConnection } from "./SSHService";

interface FirewallDebugConditions
{
    protocol: "Any" | "TCP" | "UDP" | "ICMP";
    destinationAddressRange?: string;
    destinationPort?: number;
    sourceAddressRange?: string;
}

export interface FirewallDebugSettings
{
    hookBridgeForward: boolean;
    hookForward: boolean;
    hookInput: boolean;
    hookOutput: boolean;
    conditions: FirewallDebugConditions;
}

interface PacketCaptureInfo
{
    correlationId: string;
    family: string;
    table: string;
    chain: string;
    entryType: string;
    info: string;
    verdict: string;
}

@Injectable
export class HostFirewallTracingManager
{
    constructor(private remoteConnectionsManager: RemoteConnectionsManager)
    {
        this.hostData = {};
        this.hostSettings = {};
        this.hostConnections = {};
        this._onChanges = new Subject<number>;
    }

    //Public methods
    public ClearCapturedData(hostId: number)
    {
        delete this.hostData[hostId];
    }

    public DisableTracing(hostId: number)
    {
        delete this.hostSettings[hostId];

        this._onChanges.Next(hostId);

        const conn = this.hostConnections[hostId];
        if(conn !== undefined)
        {
            conn.clientChannel?.close();
            conn.connection.Close();
        }
        delete this.hostConnections[hostId];
    }

    public async EnableTracing(hostId: number, settings: FirewallDebugSettings)
    {
        this.DisableTracing(hostId); //ensure tracing is not already enabled

        this.hostSettings[hostId] = settings;

        this._onChanges.Next(hostId);

        const conn = await this.remoteConnectionsManager.AcquireNewSelfManagedConnection(hostId);
        this.hostConnections[hostId] = {
            connection: conn,
        };

        const channel = await conn.ExecuteInteractiveCommand("sudo --stdin nft monitor trace", true);
        this.hostConnections[hostId]!.clientChannel = channel;

        channel.stdout.setEncoding("utf-8");
        channel.stdout.on("data", this.AppendData.bind(this, hostId));
        channel.stderr.setEncoding("utf-8");
        channel.stderr.on("data", console.log);
    }

    public GetTracingConditions(hostId: number)
    {
        const conds = this.hostSettings[hostId]?.conditions;
        return conds;
    }

    public GetTracingSettings(hostId: number): FirewallDebugSettings
    {
        const settings = this.hostSettings[hostId];
        if(settings === undefined)
        {
            return {
                conditions: {
                    protocol: "TCP"
                },
                hookBridgeForward: false,
                hookForward: false,
                hookInput: false,
                hookOutput: false
            };
        }

        return settings;
    }

    public IsTracingEnabled(hostId: number, hook: "BRIDGE_FORWARD" | "FORWARD" | "INPUT" | "OUTPUT")
    {
        const settings = this.hostSettings[hostId];
        if(settings === undefined)
            return false;
        switch(hook)
        {
            case "BRIDGE_FORWARD":
                return settings.hookBridgeForward;
            case "FORWARD":
                return settings.hookForward;
            case "INPUT":
                return settings.hookInput;
            case "OUTPUT":
                return settings.hookOutput;
        }
    }

    public ReadCapturedData(hostId: number)
    {
        const data = this.hostData[hostId];
        if(data === undefined)
            return [];

        while(true)
        {
            const idx = data.unparsed.indexOf("\n");
            if(idx === -1)
                break;
            const line = data.unparsed.substring(0, idx);
            data.unparsed = data.unparsed.substring(idx+1);

            const entry = this.ParseEntryMetdata(line);
            data.parsed.push(entry);
        }

        return data.parsed;
    }

    public SubscribeForChanges(observer: Observer<number>)
    {
        this._onChanges.Subscribe(observer);
    }

    //Private state
    private hostData: NumberDictionary<{ parsed: PacketCaptureInfo[]; unparsed: string }>;
    private hostSettings: NumberDictionary<FirewallDebugSettings>;
    private hostConnections: NumberDictionary<{ connection: SSHConnection; clientChannel?: ssh2.ClientChannel; }>;
    private _onChanges: Subject<number>;

    //Private methods
    private AppendData(hostId: number, data: string)
    {
        if(hostId in this.hostData)
            this.hostData[hostId]!.unparsed += data;
        else
        {
            this.hostData[hostId] = {
                parsed: [],
                unparsed: data
            };
        }
    }

    private ParseBracketedVerdict(data: string[])
    {
        let verdict = data[data.length - 1].TrimRight(")");
        data.Remove(data.length - 1);

        if(data[data.length - 1] === "jump")
        {
            verdict = "jump " + verdict;
            data.Remove(data.length - 1);
        }

        if(data[data.length - 1] !== "(verdict")
            throw new Error("Syntax error: '" + data.join(" ") + "'");
        data.Remove(data.length - 1);

        return verdict;
    }

    private ParseEntryMetdata(line: string): PacketCaptureInfo
    {
        const parts = line.split(" ");

        if(parts[0] !== "trace")
            throw new Error("Syntax error: " + line);
        if(parts[1] !== "id")
            throw new Error("Syntax error: " + line);

        const entryType = parts[6];
        const typeData = parts.splice(7);
        let data;
        switch(entryType)
        {
            case "packet:":
                data = this.ParsePacketMetadata(typeData);
                break;
            case "rule":
                data = this.ParseRuleMetadata(typeData);
                break;
            case "policy":
            case "verdict":
                data = { type: "Verdict", info: [], verdict: typeData[0] };
                break;
            case "unknown":
                data = this.ParseUnknownRuleMetadata(typeData);
                break;
            default:
                throw new Error("Unknown type: " + entryType + " -> " + line);
        }

        return {
            correlationId: parts[2],
            family: parts[3],
            table: parts[4],
            chain: parts[5],
            entryType: data.type,
            info: data.info.join(" "),
            verdict: data.verdict
        };
    }

    private ParsePacketMetadata(data: string[])
    {
        return {
            type: "New packet",
            info: data,
            verdict: ""
        };
    }

    private ParseRuleMetadata(data: string[])
    {
        return {
            type: "Match rule",
            info: data,
            verdict: this.ParseBracketedVerdict(data)
        };
    }

    private ParseUnknownRuleMetadata(data: string[])
    {

        return {
            type: "Unknown rule",
            info: data,
            verdict: this.ParseBracketedVerdict(data)
        }
    }
}