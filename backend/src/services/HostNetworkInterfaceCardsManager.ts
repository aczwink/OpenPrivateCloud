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

import { Injectable } from "acts-util-node";
import { HostMetricsService } from "./HostMetricsService";
import { RemoteCommandExecutor } from "./RemoteCommandExecutor";
import { IPv4 } from "../common/IPv4";
import { SystemServicesManager } from "./SystemServicesManager";
import { CIDRRange } from "../common/CIDRRange";

@Injectable
export class HostNetworkInterfaceCardsManager
{
    constructor(private hostMetricsService: HostMetricsService, private remoteCommandExecutor: RemoteCommandExecutor, private systemServicesManager: SystemServicesManager)
    {
    }

    //Public methods
    public async AddIPAddress(hostId: number, interfaceName: string, ip: IPv4, netAddressLength: number)
    {
        const addrAssignmentCommand = ["ip", "address", "add", "dev", interfaceName, ip.ToString() + "/" + netAddressLength];
        await this.remoteCommandExecutor.ExecuteCommand(["sudo", ...addrAssignmentCommand], hostId);
    }

    public async CreateBridge(hostId: number, bridgeName: string, ip: IPv4, netAddressLength: number)
    {
        //"stp_state", "0"
        const bridgeCreationCommand = ["ip", "link", "add", "name", bridgeName, "type", "bridge", "forward_delay", "0"];
        await this.remoteCommandExecutor.ExecuteCommand(["sudo", ...bridgeCreationCommand], hostId);

        const bridgeAddrAssignmentCommand = ["ip", "address", "add", "dev", bridgeName, ip.ToString() + "/" + netAddressLength];
        await this.remoteCommandExecutor.ExecuteCommand(["sudo", ...bridgeAddrAssignmentCommand], hostId);

        const bringBridgeUpCommand = ["ip", "link", "set", "dev", bridgeName, "up"];
        await this.remoteCommandExecutor.ExecuteCommand(["sudo", ...bringBridgeUpCommand], hostId);

        await this.PersistantNetInterface(hostId, bridgeName, [bridgeCreationCommand, bridgeAddrAssignmentCommand, bringBridgeUpCommand]);
    }

    public async CreateVLAN_SubInterface(hostId: number, interfaceName: string, parentInterfaceName: string)
    {
        const createCmd = ["ip", "link", "add", interfaceName, "link", parentInterfaceName, "type", "ipvlan", "mode", "l2"];
        await this.remoteCommandExecutor.ExecuteCommand(["sudo", ...createCmd], hostId);

        const upCmd = ["ip", "link", "set", interfaceName, "up"];
        await this.remoteCommandExecutor.ExecuteCommand(["sudo", ...upCmd], hostId);

        await this.PersistantNetInterface(hostId, interfaceName, [createCmd, upCmd]);
    }

    public async DeleteBridge(hostId: number, bridgeName: string)
    {
        await this.remoteCommandExecutor.ExecuteCommand(["sudo", "ip", "link", "delete", bridgeName, "type", "bridge"], hostId);

        await this.systemServicesManager.StopService(hostId, bridgeName);
        await this.systemServicesManager.DeleteService(hostId, bridgeName);
    }

    public async DeleteVLAN_SubInterface(hostId: number, interfaceName: string)
    {
        await this.remoteCommandExecutor.ExecuteCommandWithExitCode(["sudo", "ip", "link", "del", interfaceName], hostId);

        await this.systemServicesManager.StopService(hostId, interfaceName);
        await this.systemServicesManager.DeleteService(hostId, interfaceName);
    }

    public async DoesInterfaceExist(hostId: number, interfaceName: string)
    {
        const result = await this.remoteCommandExecutor.ExecuteCommandWithExitCode(["ip", "link", "show", interfaceName], hostId);
        return result === 0;
    }

    public async FindDefaultGateway(hostId: number)
    {
        const result = await this.remoteCommandExecutor.ExecuteBufferedCommand(["/usr/sbin/route", "-n", "|", "grep", "'UG[ \t]'", "|", "awk", "'{print $2}'"], hostId);
        return result.stdOut.trim();
    }

    public async FindExternalNetworkInterface(hostId: number)
    {
        const stats = await this.hostMetricsService.ReadNetworkStatistics(hostId);
        const filtered = stats.filter(x => x.interfaceName.startsWith("en") || x.interfaceName.startsWith("eth"));
        if(filtered.length != 1)
            throw new Error("Method not implemented.");
        return filtered[0].interfaceName;
    }

    public async FindInterfaceSubnet(hostId: number, interfaceName: string)
    {
        const result = await this.remoteCommandExecutor.ExecuteBufferedCommand(["ip", "-o", "-f", "inet", "addr", "show", interfaceName, "|", "awk", "'/scope global/ {print $4}'"], hostId);
        const ipCidr = new CIDRRange(result.stdOut.trim());
        const netAddress = ipCidr.netAddress.intValue & ipCidr.GenerateSubnetMask().intValue;

        return new CIDRRange((new IPv4(netAddress).ToString()) + "/" + ipCidr.length);
    }

    public async QueryAllNetworkInterfaces(hostId: number)
    {
        const stats = await this.hostMetricsService.ReadNetworkStatistics(hostId);
        return stats.map(x => x.interfaceName);
    }

    //Private methods
    private async PersistantNetInterface(hostId: number, interfaceName: string, setupCommands: string[][])
    {
        const persistentCommand = setupCommands.map(x => x.join(" ")).join(" && ");
        await this.systemServicesManager.CreateOrUpdateService(hostId, {
            before: ["docker.service"],
            command: "/bin/bash -c '" + persistentCommand + "'",
            environment: {},
            groupName: "root",
            name: interfaceName,
            userName: "root"
        });

        await this.systemServicesManager.EnableService(hostId, interfaceName);
    }
}