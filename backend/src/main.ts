/**
 * OpenPrivateCloud
 * Copyright (C) 2019-2022 Amir Czwink (amir130@hotmail.de)
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
import { Factory, GlobalInjector, HTTP, ModuleLoader } from "acts-util-node";
import { APIRegistry } from "acts-util-apilib";
import { HTTPAuthHandler } from "./HTTPAuthHandler";
import { DBConnectionsManager } from "./data-access/DBConnectionsManager";
import { RegisterResourceProviders } from "./resource-providers/registry";
import { APISchemaService } from "./services/APISchemaService";

const port = 8078;

async function SetupServer()
{
    const openAPIDef: OpenAPI.Root = (await import("../dist/openapi.json")) as any;
    GlobalInjector.RegisterInstance(APISchemaService, new APISchemaService(openAPIDef));
    
    RegisterResourceProviders();

    const requestHandlerChain = Factory.CreateRequestHandlerChain();
    requestHandlerChain.AddCORSHandler([
        "https://localhost:8079",
        "https://" + os.hostname() + ":8079",
    ]);
    requestHandlerChain.AddBodyParser();

    const apiLoader = new ModuleLoader;
    await apiLoader.LoadDirectory(__dirname + "/api/");
    await apiLoader.LoadDirectory(__dirname + "/resource-providers/");

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

SetupServer();