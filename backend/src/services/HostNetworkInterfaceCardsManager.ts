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

@Injectable
export class HostNetworkInterfaceCardsManager
{
    constructor(private hostMetricsService: HostMetricsService, private remoteCommandExecutor: RemoteCommandExecutor, private systemServicesManager: SystemServicesManager)
    {
    }

    //Public methods
    public async CreateBridge(hostId: number, bridgeName: string, ip: IPv4, netAddressLength: number)
    {
        //"stp_state", "0"
        const bridgeCreationCommand = ["ip", "link", "add", "name", bridgeName, "type", "bridge", "forward_delay", "0"];
        await this.remoteCommandExecutor.ExecuteCommand(["sudo", ...bridgeCreationCommand], hostId);

        const bridgeAddrAssignmentCommand = ["ip", "address", "add", "dev", bridgeName, ip.ToString() + "/" + netAddressLength];
        await this.remoteCommandExecutor.ExecuteCommand(["sudo", ...bridgeAddrAssignmentCommand], hostId);

        const bringBridgeUpCommand = ["ip", "link", "set", "dev", bridgeName, "up"];
        await this.remoteCommandExecutor.ExecuteCommand(["sudo", ...bringBridgeUpCommand], hostId);

        const persistentCommand = [bridgeCreationCommand, bridgeAddrAssignmentCommand, bringBridgeUpCommand].map(x => x.join(" ")).join(" && ");
        await this.systemServicesManager.CreateOrUpdateService(hostId, {
            before: ["docker.service"],
            command: "/bin/bash -c '" + persistentCommand + "'",
            environment: {},
            groupName: "root",
            name: bridgeName,
            userName: "root"
        });

        await this.systemServicesManager.EnableService(hostId, bridgeName);
    }

    public async DeleteBridge(hostId: number, bridgeName: string)
    {
        await this.remoteCommandExecutor.ExecuteCommand(["sudo", "ip", "link", "delete", bridgeName, "type", "bridge"], hostId);

        await this.systemServicesManager.StopService(hostId, bridgeName);
        await this.systemServicesManager.DeleteService(hostId, bridgeName);
    }

    public async DoesInterfaceExist(hostId: number, interfaceName: string)
    {
        const result = await this.remoteCommandExecutor.ExecuteCommandWithExitCode(["ip", "link", "show", interfaceName], hostId);
        return result === 0;
    }

    public async FindExternalNetworkInterface(hostId: number)
    {
        const stats = await this.hostMetricsService.ReadNetworkStatistics(hostId);
        const filtered = stats.filter(x => x.interfaceName.startsWith("en") || x.interfaceName.startsWith("eth"));
        if(filtered.length != 1)
            throw new Error("Method not implemented.");
        return filtered[0].interfaceName;
    }

    public async QueryAllNetworkInterfaces(hostId: number)
    {
        const stats = await this.hostMetricsService.ReadNetworkStatistics(hostId);
        return stats.map(x => x.interfaceName);
    }
}