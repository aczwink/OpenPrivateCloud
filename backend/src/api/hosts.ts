/**
 * OpenPrivateCloud
 * Copyright (C) 2019-2024 Amir Czwink (amir130@hotmail.de)
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
import { APIController, Body, BodyProp, Common, Delete, Get, NotFound, Path, Post, Put } from "acts-util-apilib";
import { HostsController } from "../data-access/HostsController";
import { DistroInfoService } from "../services/DistroInfoService";
import { HostAvailabilityManager } from "../services/HostAvailabilityManager";
import { HostPerformanceMeasurementService } from "../services/HostPerformanceMeasurementService";
import { HostUpdateManager } from "../services/HostUpdateManager";
import { RemoteCommandExecutor } from "../services/RemoteCommandExecutor";
import { HostNetworkInterfaceCardsManager } from "../services/HostNetworkInterfaceCardsManager";
import { FirewallRule, HostFirewallZonesManager, PortForwardingRule } from "../services/HostFirewallZonesManager";
import { HostFirewallSettingsManager } from "../services/HostFirewallSettingsManager";
import { ProcessTrackerManager } from "../services/ProcessTrackerManager";
import { FirewallDebugSettings, HostFirewallTracingManager } from "../services/HostFirewallTracingManager";
import { HostTakeOverService } from "../services/HostTakeOverService";
import { HealthController } from "../data-access/HealthController";
import { NetworkTraceSimulator } from "../services/NetworkTraceSimulator";
import { IPv4 } from "../common/IPv4";
import { DateTime } from "acts-util-node";
import { CIDRRange } from "../common/CIDRRange";
import { ClusterKeyStoreController } from "../data-access/ClusterKeyStoreController";
import { HostConfigController } from "../data-access/HostConfigController";

interface AddHostDTO
{
    hostName: string;
    /**
     * The Linux user password of the "opc-hu" user on the host. The controller will change that password during the takeover process.
     * @default opchostuser
     */
    password: string;
}

interface HostBootEntryDTO
{
    bootNumber: number;
    bootTime: Date;
}

interface NetworkInterfaceDTO
{
    name: string;
    zone: string;
    ip: string;
    subnet: string;
}

interface NetworkTraceSimPacketDataDTO
{
    sourceAddress: string;
    protocol: "TCP" | "UDP";
    port: number;
}
interface NetworkTraceSimResultDTO
{
    log: string[];
}

interface ProcessDto
{
    hostName: string;
    id: number;
    startTime: DateTime;
    status: number;
    title: string;
}

interface UnattendedUpgradeConfigDto
{
    unattendedUpgrades: boolean;
    updatePackageLists: boolean;
}

interface UpdateHostPasswordDTO
{
    /**
     * The Linux user password of the "opc-hu" user on the host.
     * Use this in case the controller can not reach the host anymore, for example because you had to set it up again from scratch and the stored password does not work anymore.
     * The controller will change that password during the takeover process.
     */
    password: string;
}

interface UpdateInfoDto
{
    distributionName: string;
    unattendedUpgradeConfig: UnattendedUpgradeConfigDto;
    updatablePackagesCount: number;
}

@APIController("hosts")
class HostsAPIController
{
    constructor(private hostTakeOverService: HostTakeOverService, private hostsController: HostsController)
    {
    }

    @Post()
    public async AddHost(
        @Body dto: AddHostDTO
    )
    {
        await this.hostTakeOverService.TakeOverHost(dto.hostName, dto.password);
    }

    @Get()
    public QueueHosts()
    {
        return this.hostsController.RequestHosts();
    }
}

@APIController("hosts/{hostName}")
class HostAPIController
{
    constructor(private hostsController: HostsController, private remoteCommandExecutor: RemoteCommandExecutor, private hostPerformanceMeasurementService: HostPerformanceMeasurementService,
        private hostNetworkInterfaceCardsManager: HostNetworkInterfaceCardsManager, private hostFirewallZonesManager: HostFirewallZonesManager, private healthController: HealthController,
        private processTrackerManager: ProcessTrackerManager, private hostTakeOverService: HostTakeOverService, private clusterKeyStoreController: ClusterKeyStoreController,
        private hostConfigController: HostConfigController)
    {
    }

    @Delete()
    public async DeleteHost(
        @Path hostName: string
    )
    {
        const hostId = await this.hostsController.RequestHostId(hostName);
        if(hostId === undefined)
            return NotFound("host does not exist");

        await this.clusterKeyStoreController.DeleteHostSecretValues(hostId);
        await this.hostConfigController.DeleteConfig(hostId);
        await this.hostsController.DeleteHost(hostId);
    }

    @Get()
    public async QueryHost(
        @Path hostName: string
    )
    {
        const hostId = await this.hostsController.RequestHostId(hostName);
        if(hostId === undefined)
            return NotFound("host does not exist");
        return await this.healthController.QueryHostHealthData(hostId);
    }

    @Get("boots")
    public async QueryBoots(
        @Path hostName: string
    )
    {
        const hostId = await this.hostsController.RequestHostId(hostName);
        if(hostId === undefined)
            return NotFound("host does not exist");
        
        const data = await this.remoteCommandExecutor.ExecuteBufferedCommand(["sudo", "journalctl", "--list-boots", "-o", "json"], hostId);
        const entries = JSON.parse(data.stdOut) as any[];
        return entries.map( (x: any) => {
            const result: HostBootEntryDTO = {
                bootNumber: x.index,
                bootTime: new Date(x.first_entry / 1000)
            };
            return result;
        });
    }

    @Get("networkInterfaces")
    public async QueryNetworkInterfaces(
        @Path hostName: string
    )
    {
        const hostId = await this.hostsController.RequestHostId(hostName);
        if(hostId === undefined)
            return NotFound("host does not exist");

        const interfaces = await this.hostNetworkInterfaceCardsManager.QueryAllNetworkInterfaces(hostId);
        const addresses = await this.hostNetworkInterfaceCardsManager.QueryAllNetworkInterfacesWithAddresses(hostId);
        return Promise.all(interfaces.map(async x => {
            const zone = this.hostFirewallZonesManager.DetermineAssignedZoneForNetworkInterface(hostId, x);
            const iface = addresses.find(y => y.ifname === x);
            const ipv4 = iface!.addr_info.find(x => x.family === "inet");
            const res: NetworkInterfaceDTO = {
                name: x,
                zone,
                ip: ipv4?.local ?? "No IPv4",
                subnet: (ipv4 === undefined) ? "No IPv4 subnet": CIDRRange.FromIP(new IPv4(ipv4.local), ipv4.prefixlen).ToString()
            };
            return res;
        }));
    }

    @Put("password")
    public async UpdatePassword(
        @Path hostName: string,
        @Body dto: UpdateHostPasswordDTO
    )
    {
        const hostId = await this.hostsController.RequestHostId(hostName);
        if(hostId === undefined)
            return NotFound("host does not exist");

        await this.hostTakeOverService.Reconnect(hostId, hostName, dto.password);
    }

    @Get("performance")
    public async QueryPerformanceStats(
        @Path hostName: string
    )
    {
        const hostId = await this.hostsController.RequestHostId(hostName);
        if(hostId === undefined)
            return NotFound("host does not exist");
            
        return await this.hostPerformanceMeasurementService.QueryPerformanceStats(hostId);
    }

    @Get("processes")
    public QueryProcesses(
        @Path hostName: string
    )
    {
        return this.processTrackerManager.processes.Map(x => {
            const res: ProcessDto = {
                hostName: x.hostName,
                id: x.id,
                startTime: x.startTime,
                status: x.status,
                title: x.title
            };
            return res;
        }).Filter(x => x.hostName === hostName).ToArray();
    }

    @Post("reboot")
    public async Reboot(
        @Path hostName: string
    )
    {
        const hostId = await this.hostsController.RequestHostId(hostName);
        if(hostId === undefined)
            return NotFound("host does not exist");
            
        this.IssueShutdown(hostId, ["-r"]);
    }

    @Post("shutdown")
    public async Shutdown(
        @Path hostName: string
    )
    {
        const hostId = await this.hostsController.RequestHostId(hostName);
        if(hostId === undefined)
            return NotFound("host does not exist");
            
        this.IssueShutdown(hostId, []);
    }

    //Private methods
    private IssueShutdown(hostId: number, additionalArgs: string[])
    {
        setTimeout(() => this.remoteCommandExecutor.ExecuteCommand(["sudo", "shutdown"].concat(additionalArgs).concat(["0"]), hostId), 5000);
    }
}

@APIController("hosts/{hostName}/firewall")
class _api_
{
    constructor(private hostsController: HostsController, private hostFirewallSettingsManager: HostFirewallSettingsManager)
    {
    }

    @Common()
    public async QueryHostId(
        @Path hostName: string
    )
    {
        const hostId = await this.hostsController.RequestHostId(hostName);
        if(hostId === undefined)
            return NotFound("host does not exist");
        return hostId;
    }

    @Get("{direction}")
    public async QueryRuleSet(
        @Common hostId: number,
        @Path direction: "Inbound" | "Outbound",
    )
    {
        const ruleSet = await this.hostFirewallSettingsManager.QueryHostFirewallRules(hostId, direction);

        //implicit rules
        if(direction === "Inbound")
        {
            ruleSet.push({
                priority: 65535,
                destinationPortRanges: "Any",
                protocol: "Any",
                source: "Any",
                destination: "Any",
                action: "Deny",
                comment: "Deny all inbound traffic"
            });
        }
        else
        {
            ruleSet.push({
                priority: 65535,
                destinationPortRanges: "Any",
                protocol: "Any",
                source: "Any",
                destination: "Any",
                action: "Allow",
                comment: "Allow all outbound traffic"
            });
        }

        return ruleSet;
    }

    @Delete("{direction}")
    public async DeleteRule(
        @Common hostId: number,
        @Path direction: "Inbound" | "Outbound",
        @BodyProp priority: number
    )
    {
        await this.hostFirewallSettingsManager.DeleteRule(hostId, direction, priority);
    }

    @Put("{direction}")
    public async SetRule(
        @Common hostId: number,
        @Path direction: "Inbound" | "Outbound",
        @Body rule: FirewallRule
    )
    {
        await this.hostFirewallSettingsManager.SetRule(hostId, direction, rule);
    }
}

@APIController("hosts/{hostName}/firewallTracing")
class _api9_
{
    constructor(private hostsController: HostsController, private hostFirewallTracingManager: HostFirewallTracingManager, private networkTraceSimulator: NetworkTraceSimulator)
    {
    }

    @Common()
    public async QueryHostId(
        @Path hostName: string
    )
    {
        const hostId = await this.hostsController.RequestHostId(hostName);
        if(hostId === undefined)
            return NotFound("host does not exist");
        return hostId;
    }

    @Get()
    public QueryConfig(
        @Common hostId: number,
    )
    {
        return this.hostFirewallTracingManager.GetTracingSettings(hostId);
    }

    @Put()
    public async UpdateConfig(
        @Common hostId: number,
        @Body config: FirewallDebugSettings
    )
    {
        const enabled = config.hookBridgeForward || config.hookForward || config.hookInput || config.hookOutput;
        if(enabled)
            await this.hostFirewallTracingManager.EnableTracing(hostId, config);
        else
            await this.hostFirewallTracingManager.DisableTracing(hostId);
    }

    @Delete("data")
    public ClearData(
        @Common hostId: number,
    )
    {
        return this.hostFirewallTracingManager.ClearCapturedData(hostId);
    }

    @Get("data")
    public QueryData(
        @Common hostId: number,
    )
    {
        return this.hostFirewallTracingManager.ReadCapturedData(hostId);
    }

    @Put("simulate")
    public async ExecuteNetworkTraceSimulation(
        @Common hostId: number,
        @Body packetData: NetworkTraceSimPacketDataDTO
    )
    {
        const result = await this.networkTraceSimulator.ExecuteNetworkTraceSimulation(hostId, new IPv4(packetData.sourceAddress), packetData.protocol, packetData.port);
        const res: NetworkTraceSimResultDTO = {
            log: result
        };

        return res;
    }
}

@APIController("hosts/{hostName}/portForwarding")
class _api8_
{
    constructor(private hostsController: HostsController, private hostFirewallSettingsManager: HostFirewallSettingsManager)
    {
    }

    @Common()
    public async QueryHostId(
        @Path hostName: string
    )
    {
        const hostId = await this.hostsController.RequestHostId(hostName);
        if(hostId === undefined)
            return NotFound("host does not exist");
        return hostId;
    }

    @Post()
    public async AddRule(
        @Common hostId: number,
        @Body rule: PortForwardingRule
    )
    {
        await this.hostFirewallSettingsManager.AddPortForwardingRule(hostId, rule);
    }

    @Get()
    public async QueryRuleSet(
        @Common hostId: number,
    )
    {
        const ruleSet = await this.hostFirewallSettingsManager.QueryPortForwardingRules(hostId);

        return ruleSet;
    }

    @Delete("{protocol}/{port}")
    public async DeleteRule(
        @Common hostId: number,
        @Path protocol: "TCP" | "UDP",
        @Path port: number
    )
    {
        await this.hostFirewallSettingsManager.DeletePortForwardingRule(hostId, protocol, port);
    }
}

@APIController("hosts/{hostName}/update")
class HostUpdateAPIController
{
    constructor(private hostsController: HostsController, private hostUpdateManager: HostUpdateManager, private distroInfoService: DistroInfoService,
        private hostHealthManager: HostAvailabilityManager)
    {
    }

    @Common()
    public async QueryHostId(
        @Path hostName: string
    )
    {
        const hostId = await this.hostsController.RequestHostId(hostName);
        if(hostId === undefined)
            return NotFound("host does not exist");
        return hostId;
    }

    @Get()
    public async QueryUpdateInfo(
        @Common hostId: number
    )
    {
        const distroName = await this.distroInfoService.FetchDisplayName(hostId);            
        const updateInfo = await this.hostUpdateManager.QueryUpdateInfo(hostId);

        const result: UpdateInfoDto = {
            distributionName: distroName,
            unattendedUpgradeConfig: {
                unattendedUpgrades: updateInfo.config.unattendedUpgrades,
                updatePackageLists: updateInfo.config.updatePackageLists
            },
            updatablePackagesCount: updateInfo.updatablePackagesCount,
        };
        return result;
    }

    @Put()
    public async SetUpdateConfig(
        @Common hostId: number,
        @Body config: UnattendedUpgradeConfigDto
    )
    {
        await this.hostUpdateManager.SetUnattendedUpgradeConfig(hostId, config.unattendedUpgrades, config.updatePackageLists);
    }

    @Post()
    public async UpdateSystem(
        @Common hostId: number
    )
    {
        await this.hostUpdateManager.UpdateSystem(hostId);
        await this.hostHealthManager.EnsureHostIsConfiguredAppropriatly(hostId);
    }
}