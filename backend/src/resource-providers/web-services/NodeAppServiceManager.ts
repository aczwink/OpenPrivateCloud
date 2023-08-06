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
import path from "path";
import { Injectable } from "acts-util-node";
import { HostStoragesController } from "../../data-access/HostStoragesController";
import { ResourcesController } from "../../data-access/ResourcesController";
import { ResourcesManager } from "../../services/ResourcesManager";
import { ModulesManager } from "../../services/ModulesManager";
import { RemoteFileSystemManager } from "../../services/RemoteFileSystemManager";
import { DeploymentContext, ResourceStateResult } from "../ResourceProvider";
import { NodeAppServiceProperties } from "./Properties";
import { SystemServicesManager } from "../../services/SystemServicesManager";
import { opcSpecialGroups, opcSpecialUsers } from "../../common/UserAndGroupDefinitions";
import { Dictionary } from "acts-util-core";
import { LightweightResourceReference } from "../../common/ResourceReference";

interface NodeEnvironmentVariableMapping
{
    varName: string;
    value: string;
}

export interface NodeAppConfig
{
    autoStart: boolean;
    env: NodeEnvironmentVariableMapping[];
}

@Injectable
export class NodeAppServiceManager
{
    constructor(private resourcesManager: ResourcesManager, private modulesManager: ModulesManager, private instancesController: ResourcesController,
        private hostStoragesController: HostStoragesController, private remoteFileSystemManager: RemoteFileSystemManager,
        private systemServicesManager: SystemServicesManager)
    {
    }

    //Public methods
    public async DeleteResource(resourceReference: LightweightResourceReference)
    {
        await this.systemServicesManager.DeleteService(resourceReference.hostId, this.DeriveSystemUnitName(resourceReference));
        await this.resourcesManager.RemoveResourceStorageDirectory(resourceReference);
    }

    public async ExecuteAction(resourceReference: LightweightResourceReference, action: "start" | "stop")
    {
        const serviceName = this.DeriveSystemUnitName(resourceReference);
        switch(action)
        {
            case "start":
                await this.systemServicesManager.StartService(resourceReference.hostId, serviceName);
                break;
            case "stop":
                await this.systemServicesManager.StopService(resourceReference.hostId, serviceName);
                break;
        }
    }

    public async IsAppServiceRunning(resourceReference: LightweightResourceReference)
    {
        return await this.systemServicesManager.IsServiceActive(resourceReference.hostId, this.DeriveSystemUnitName(resourceReference));
    }

    public async ProvideResource(instanceProperties: NodeAppServiceProperties, context: DeploymentContext)
    {
        await this.modulesManager.EnsureModuleIsInstalled(context.hostId, "node");

        await this.resourcesManager.CreateResourceStorageDirectory(context.resourceReference);
        await this.UpdateService(context.resourceReference, {});
    }

    public async QueryConfig(resourceReference: LightweightResourceReference): Promise<NodeAppConfig>
    {
        const serviceName = this.DeriveSystemUnitName(resourceReference);
        const serviceProps = await this.systemServicesManager.ReadServiceUnit(resourceReference.hostId, serviceName);

        return {
            autoStart: await this.systemServicesManager.IsServiceEnabled(resourceReference.hostId, serviceName),
            env: serviceProps.environment.Entries().Map(kv => ({ varName: kv.key.toString(), value: kv.value! })).ToArray()
        };
    }

    public async QueryResourceState(resourceReference: LightweightResourceReference): Promise<ResourceStateResult>
    {
        const isRunning = await this.IsAppServiceRunning(resourceReference);
        if(isRunning)
            return "running";
        return "stopped";
    }

    public async QueryStatus(resourceReference: LightweightResourceReference)
    {
        const serviceName = this.DeriveSystemUnitName(resourceReference);
        return await this.systemServicesManager.QueryStatus(resourceReference.hostId, serviceName);
    }

    public async UpdateConfig(resourceReference: LightweightResourceReference, config: NodeAppConfig)
    {
        const env = config.env.Values().ToDictionary(e => e.varName, e => e.value);
        await this.UpdateService(resourceReference, env);

        const serviceName = this.DeriveSystemUnitName(resourceReference);
        if(config.autoStart)
            await this.systemServicesManager.EnableService(resourceReference.hostId, serviceName);
        else
            await this.systemServicesManager.DisableService(resourceReference.hostId, serviceName);
    }

    public async UpdateContent(resourceReference: LightweightResourceReference, buffer: Buffer)
    {
        const resourceDir = this.resourcesManager.BuildResourceStoragePath(resourceReference);

        await this.remoteFileSystemManager.WriteFile(resourceReference.hostId, path.join(resourceDir, "index.js"), buffer);
    }

    //Private methods
    private DeriveSystemUnitName(resourceReference: LightweightResourceReference)
    {
        return "opc-rnas-" + resourceReference.id;
    }

    private async UpdateService(resourceReference: LightweightResourceReference, env: Dictionary<string>)
    {
        const resourceDir = this.resourcesManager.BuildResourceStoragePath(resourceReference);

        await this.systemServicesManager.CreateOrUpdateService(resourceReference.hostId, {
            before: [],
            command: "node " + path.join(resourceDir, "index.js"),
            environment: env,
            groupName: opcSpecialGroups.host,
            name: this.DeriveSystemUnitName(resourceReference),
            userName: opcSpecialUsers.host
        });
    }
}