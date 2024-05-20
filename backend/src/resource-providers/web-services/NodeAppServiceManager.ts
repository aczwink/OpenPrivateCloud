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
import path from "path";
import { Injectable } from "acts-util-node";
import { ResourcesManager } from "../../services/ResourcesManager";
import { ModulesManager } from "../../services/ModulesManager";
import { RemoteFileSystemManager } from "../../services/RemoteFileSystemManager";
import { DeploymentContext, ResourceCheckResult, ResourceCheckType, ResourceState } from "../ResourceProvider";
import { NodeAppServiceProperties } from "./Properties";
import { SystemServicesManager } from "../../services/SystemServicesManager";
import { opcSpecialGroups, opcSpecialUsers } from "../../common/UserAndGroupDefinitions";
import { Dictionary } from "acts-util-core";
import { LightweightResourceReference } from "../../common/ResourceReference";
import { ResourceConfigController } from "../../data-access/ResourceConfigController";
import { KeyVaultManager } from "../security-services/KeyVaultManager";
import { ResourceDependenciesController } from "../../data-access/ResourceDependenciesController";
import { HealthStatus } from "../../data-access/HealthController";

interface NodeEnvironmentVariableMappingKeyVaultSecretValue
{
    type: "keyvault-secret";
    keyVaultResourceId: number;
    secretName: string;
}
interface NodeEnvironmentVariableMappingStringValue
{
    type: "string";
    value: string;
}

type NodeEnvironmentVariableMappingValue = NodeEnvironmentVariableMappingKeyVaultSecretValue | NodeEnvironmentVariableMappingStringValue;

export interface NodeEnvironmentVariableMapping
{
    varName: string;
    value: NodeEnvironmentVariableMappingValue;
}

export interface NodeAppServiceConfig
{
    autoStart: boolean;
    env: NodeEnvironmentVariableMapping[];
}

@Injectable
export class NodeAppServiceManager
{
    constructor(private resourcesManager: ResourcesManager, private modulesManager: ModulesManager, private remoteFileSystemManager: RemoteFileSystemManager, private resourceDependenciesController: ResourceDependenciesController,
        private systemServicesManager: SystemServicesManager, private resourceConfigController: ResourceConfigController, private keyVaultManager: KeyVaultManager)
    {
    }

    //Public methods
    public async CheckResource(resourceReference: LightweightResourceReference, type: ResourceCheckType): Promise<HealthStatus | ResourceCheckResult>
    {
        switch(type)
        {
            case ResourceCheckType.Availability:
            {
                const exists = await this.systemServicesManager.DoesServiceUnitExist(resourceReference.hostId, this.DeriveSystemUnitName(resourceReference));
                if(!exists)
                {
                    return {
                        status: HealthStatus.Corrupt,
                        context: "service does not exist"
                    };
                }

                const fp = await this.resourcesManager.IsResourceStoragePathOwnershipCorrect(resourceReference);
                if(!fp)
                {
                    return {
                        status: HealthStatus.Corrupt,
                        context: "incorrect file ownership"
                    };
                }
            }
            break;
            case ResourceCheckType.ServiceHealth:
            {
                const fp = await this.resourcesManager.IsResourceStoragePathOwnershipCorrect(resourceReference);
                if(!fp)
                {
                    const rootPath = this.resourcesManager.BuildResourceStoragePath(resourceReference);
                    await this.resourcesManager.CorrectResourceStoragePathOwnership(resourceReference, [{ path: rootPath, recursive: true }]);
                }
            }
            break;
        }

        return HealthStatus.Up;
    }

    public async DeleteResource(resourceReference: LightweightResourceReference)
    {
        const serviceName = this.DeriveSystemUnitName(resourceReference);
        const exists = await this.systemServicesManager.DoesServiceUnitExist(resourceReference.hostId, serviceName);
        if(exists)
        {
            await this.systemServicesManager.StopService(resourceReference.hostId, serviceName);
            await this.systemServicesManager.DeleteService(resourceReference.hostId, serviceName);
        }

        await this.resourcesManager.RemoveResourceStorageDirectory(resourceReference);
    }

    public async ExecuteAction(resourceReference: LightweightResourceReference, action: "start" | "stop")
    {
        const serviceName = this.DeriveSystemUnitName(resourceReference);
        switch(action)
        {
            case "start":
                await this.systemServicesManager.StartService(resourceReference.hostId, serviceName);
                await this.systemServicesManager.EnableService(resourceReference.hostId, serviceName);
                break;
            case "stop":
                await this.systemServicesManager.StopService(resourceReference.hostId, serviceName);
                await this.systemServicesManager.DisableService(resourceReference.hostId, serviceName);
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

    public async QueryConfig(resourceReference: LightweightResourceReference): Promise<NodeAppServiceConfig>
    {
        const config = await this.resourceConfigController.QueryConfig<NodeAppServiceConfig>(resourceReference.id);
        if(config === undefined)
        {
            return {
                autoStart: false,
                env: []
            };
        }
        return config;
    }

    public async QueryResourceState(resourceReference: LightweightResourceReference): Promise<ResourceState>
    {
        const isRunning = await this.IsAppServiceRunning(resourceReference);
        if(isRunning)
            return ResourceState.Running;
        return ResourceState.Stopped;
    }

    public async QueryStatus(resourceReference: LightweightResourceReference)
    {
        const serviceName = this.DeriveSystemUnitName(resourceReference);
        return await this.systemServicesManager.QueryStatus(resourceReference.hostId, serviceName);
    }

    public async UpdateConfig(resourceReference: LightweightResourceReference, config: NodeAppServiceConfig)
    {
        await this.resourceConfigController.UpdateOrInsertConfig(resourceReference.id, config);

        const dependencies = [];

        const env: Dictionary<string> = {};
        for (const envVar of config.env)
        {
            let value;
            switch(envVar.value.type)
            {
                case "keyvault-secret":
                    {
                        const kvRef = await this.resourcesManager.CreateResourceReference(envVar.value.keyVaultResourceId)
                        value = await this.keyVaultManager.ReadSecret(kvRef!, envVar.value.secretName);

                        dependencies.push(envVar.value.keyVaultResourceId);
                    }
                    break;
                case "string":
                    value = envVar.value.value;
                    break;
            }
            env[envVar.varName] = value;
        }

        this.resourceDependenciesController.SetResourceDependencies(resourceReference.id, dependencies);

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
            groupName: opcSpecialGroups.host.name,
            name: this.DeriveSystemUnitName(resourceReference),
            userName: opcSpecialUsers.host.name
        });
    }
}