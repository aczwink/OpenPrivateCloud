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
import { APIController, Body, BodyProp, Common, Delete, Get, NotFound, Path, Post, Put } from "acts-util-apilib";
import { HostsController } from "../data-access/HostsController";
import { DistroInfoService } from "../services/DistroInfoService";
import { HostAvailabilityManager } from "../services/HostAvailabilityManager";
import { HostPerformanceMeasurementService } from "../services/HostPerformanceMeasurementService";
import { HostsManager } from "../services/HostsManager";
import { HostUpdateManager } from "../services/HostUpdateManager";
import { RemoteCommandExecutor } from "../services/RemoteCommandExecutor";
import { HostNetworkInterfaceCardsManager } from "../services/HostNetworkInterfaceCardsManager";
import { FirewallRule, HostFirewallZonesManager } from "../services/HostFirewallZonesManager";
import { HostFirewallSettingsManager } from "../services/HostFirewallSettingsManager";

interface UnattendedUpgradeConfigDto
{
    unattendedUpgrades: boolean;
    updatePackageLists: boolean;
}

interface UpdateInfoDto
{
    distributionName: string;
    unattendedUpgradeConfig: UnattendedUpgradeConfigDto;
    updatablePackagesCount: number;
}

interface NetworkInterfaceDTO
{
    name: string;
    zone: string;
}

@APIController("hosts")
class HostsAPIController
{
    constructor(private hostsManager: HostsManager, private hostsController: HostsController)
    {
    }

    @Post()
    public async AddHost(
        @BodyProp hostName: string
    )
    {
        await this.hostsManager.TakeOverHost(hostName);
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
        private hostNetworkInterfaceCardsManager: HostNetworkInterfaceCardsManager, private hostFirewallZonesManager: HostFirewallZonesManager)
    {
    }

    @Delete()
    public async DeleteHost(
        @Path hostName: string
    )
    {
        await this.hostsController.DeleteHost(hostName);
    }

    @Get()
    public async QueryHost(
        @Path hostName: string
    )
    {
        const host = await this.hostsController.QueryHostByName(hostName);
        if(host === undefined)
            return NotFound("host does not exist");
            
        return host;
    }

    @Get("logs")
    public async QueryHostLogs(
        @Path hostName: string
    )
    {
        const hostId = await this.hostsController.RequestHostId(hostName);
        if(hostId === undefined)
            return NotFound("host does not exist");

        return await this.hostPerformanceMeasurementService.QueryLogs(hostId);
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
        return Promise.all(interfaces.map(async x => {
            const zone = await this.hostFirewallZonesManager.DetermineAssignedZoneForNetworkInterface(hostId, x);
            const res: NetworkInterfaceDTO = {
                name: x,
                zone,
            };
            return res;
        }));
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