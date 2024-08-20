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
import fs from "fs";
import * as https from "https";
import * as os from "os";
import { OpenAPI } from "acts-util-core";
import { Factory, GlobalInjector, HTTP } from "acts-util-node";
import { APIRegistry } from "acts-util-apilib";
import { HTTPAuthHandler } from "./HTTPAuthHandler";
import { DBConnectionsManager } from "./data-access/DBConnectionsManager";
import { APISchemaService } from "./services/APISchemaService";
import { HostAvailabilityManager } from "./services/HostAvailabilityManager";
import { ResourceHealthManager } from "./services/ResourceHealthManager";
import { HostFirewallZonesManager } from "./services/HostFirewallZonesManager";
import { HostFirewallSettingsManager } from "./services/HostFirewallSettingsManager";
import { VNetManager } from "./resource-providers/network-services/VNetManager";
import { OpenVPNGatewayManager } from "./resource-providers/network-services/OpenVPNGatewayManager";
import { ProcessTrackerManager } from "./services/ProcessTrackerManager";
import { ResourceEventsManager } from "./services/ResourceEventsManager";
import { HostFirewallManager } from "./services/HostFirewallManager";
import { ClusterEventsManager } from "./services/ClusterEventsManager";
import { ClusterDataProvider } from "./services/ClusterDataProvider";
import { HostsDataProvider } from "./services/data-providers/HostsDataProvider";
import { ResourceGroupsDataProvider } from "./services/data-providers/ResourcesDataProvider";

const port = 8078;

async function EnableHealthManagement()
{
    await GlobalInjector.Resolve(HostAvailabilityManager).CheckHostsHealth();
    await GlobalInjector.Resolve(HostAvailabilityManager).CheckResourcesAvailability();
    GlobalInjector.Resolve(ResourceHealthManager).ScheduleResourceChecksForAllResources();
}

function EventManagementSetup()
{
    //firewall stuff
    const rem = GlobalInjector.Resolve(ResourceEventsManager);
    const ovpnGwMgr = GlobalInjector.Resolve(OpenVPNGatewayManager);

    const fwZonesMgr = GlobalInjector.Resolve(HostFirewallZonesManager);
    fwZonesMgr.RegisterDataProvider(GlobalInjector.Resolve(HostFirewallSettingsManager));
    fwZonesMgr.RegisterDataProvider(GlobalInjector.Resolve(VNetManager));
    fwZonesMgr.RegisterDataProvider(ovpnGwMgr);

    rem.RegisterListener(ovpnGwMgr);

    GlobalInjector.Resolve(HostFirewallManager); //ensure this service exists because it listens to events which have to reset the host firewall

    //health and availability
    const cem = GlobalInjector.Resolve(ClusterEventsManager);
    cem.RegisterListener(event => {
        if(event.type === "keyStoreUnlocked")
        {
            console.log("Key store unlocked");
            EnableHealthManagement();
            SetupDataSources();
        }
    });
}

function SetupDataSources()
{
    const cdp = GlobalInjector.Resolve(ClusterDataProvider);

    cdp.RegisterSourceProvider("hosts", GlobalInjector.Resolve(HostsDataProvider));
    cdp.RegisterSourceProvider("resourceGroups", GlobalInjector.Resolve(ResourceGroupsDataProvider));
}

async function SetupWebServer()
{
    const openAPIDef: OpenAPI.Root = (await import("../dist/openapi.json")) as any;
    GlobalInjector.RegisterInstance(APISchemaService, new APISchemaService(openAPIDef));

    EventManagementSetup();

    await import("./__http-registry");
    await import("./__resource-providers-registry");

    const requestHandlerChain = Factory.CreateRequestHandlerChain();
    requestHandlerChain.AddCORSHandler([
        process.env.OPC_ALLOWED_ORIGINS!
    ]);
    requestHandlerChain.AddBodyParser();

    const backendStructure: any = await import("../dist/openapi-structure.json");
    requestHandlerChain.AddRequestHandler(GlobalInjector.Resolve(HTTPAuthHandler));
    requestHandlerChain.AddRequestHandler(new HTTP.RouterRequestHandler(openAPIDef, backendStructure, APIRegistry.endPointTargets));

    const keyPath = "/etc/OpenPrivateCloud/private.key";
    const certPath = "/etc/OpenPrivateCloud/public.crt";

    const server = https.createServer({
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath)
    }, requestHandlerChain.requestListener);

    server.listen(port, () => {
        console.log("Backend is running...");
    });

    process.on('SIGINT', function()
    {
        console.log("Shutting backend down...");
        GlobalInjector.Resolve(DBConnectionsManager).Close();
        server.close();
    });
}

function DumpCommands()
{
    const ptm = GlobalInjector.Resolve(ProcessTrackerManager);
    for (const process of ptm.processes)
    {
        console.log(process);
    }
}

process.on("uncaughtException", (error, origin) => {
    DumpCommands();
    console.log("Unhandled exception: ", error, origin);
});
process.on("unhandledRejection", (reason, promise) => {
    DumpCommands();
    console.log("Unhandled rejection: ", reason, promise);
});

SetupWebServer();