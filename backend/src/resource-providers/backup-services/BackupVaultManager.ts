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

import { DateTime, Injectable } from "acts-util-node";
import { ResourceConfigController } from "../../data-access/ResourceConfigController";
import { TaskSchedulingManager } from "../../services/TaskSchedulingManager";
import { BackupProcessService } from "./BackupProcessService";
import { BackupVaultControllerDatabaseConfig, BackupVaultDatabaseConfig, BackupVaultFileStorageConfig, BackupVaultRetentionConfig, BackupVaultSourcesConfig, BackupVaultTargetConfig, BackupVaultTrigger, KeyVaultBackupConfig, ObjectStorageBackupConfig } from "./models";
import { LightweightResourceReference } from "../../common/ResourceReference";
import { ResourceDependenciesController } from "../../data-access/ResourceDependenciesController";
import { NumberDictionary } from "acts-util-core";
import { ResourceState } from "../ResourceProvider";

interface BackupVaultConfig
{
    sources: BackupVaultSourcesConfig;
    target: BackupVaultTargetConfig;
    trigger: BackupVaultTrigger;
    retention: BackupVaultRetentionConfig;

    state: {
        lastScheduleTime?: DateTime;
    };
}

@Injectable
export class BackupVaultManager
{
    constructor(private resourceConfigController: ResourceConfigController, private backupProcessService: BackupProcessService, private taskSchedulingManager: TaskSchedulingManager, private resourceDependenciesController: ResourceDependenciesController)
    {
        this.failedBackups = {};
    }

    //Public methods
    public async AddDatabaseSource(resourceReference: LightweightResourceReference, source: BackupVaultDatabaseConfig)
    {
        const config = await this.ReadConfig(resourceReference.id);
        config.sources.databases.push(source);
        await this.WriteConfig(resourceReference.id, config);
    }

    public async AddFileStorageSource(resourceReference: LightweightResourceReference, source: BackupVaultFileStorageConfig)
    {
        const config = await this.ReadConfig(resourceReference.id);
        config.sources.fileStorages.push(source);
        await this.WriteConfig(resourceReference.id, config);
    }

    public async AddKeyVaultSource(resourceReference: LightweightResourceReference, source: KeyVaultBackupConfig)
    {
        const config = await this.ReadConfig(resourceReference.id);
        config.sources.keyVaults.push(source);
        await this.WriteConfig(resourceReference.id, config);
    }

    public async AddObjectStorageSource(resourceReference: LightweightResourceReference, source: ObjectStorageBackupConfig)
    {
        const config = await this.ReadConfig(resourceReference.id);
        config.sources.objectStorages.push(source);
        await this.WriteConfig(resourceReference.id, config);
    }

    public DidLastBackupFail(resourceId: number)
    {
        return this.failedBackups[resourceId]
    }

    public async EnsureBackupTimerIsRunningIfConfigured(resourceId: number)
    {
        const config = await this.ReadConfig(resourceId);
        if(config.trigger.type === "automatic")
        {
            const lastScheduleTime = config.state.lastScheduleTime ?? DateTime.ConstructFromUnixTimeStamp(0);
            this.taskSchedulingManager.ScheduleForInstance(resourceId, lastScheduleTime, config.trigger.schedule, this.OnAutomaticBackupTrigger.bind(this, resourceId));
        }
    }

    public QueryResourceState(resourceReference: LightweightResourceReference): ResourceState
    {
        return ResourceState.Running;
    }

    public async ReadConfig(resourceId: number): Promise<BackupVaultConfig>
    {
        const config = await this.resourceConfigController.QueryConfig<BackupVaultConfig>(resourceId);

        if(config === undefined)
        {
            return {
                sources: {
                    databases: [],
                    controllerDB: { enable: false },
                    fileStorages: [],
                    keyVaults: [],
                    objectStorages: []
                },
                target: {
                    type: "storage-device",
                    storageDeviceUUID: "",
                },
                trigger: {
                    type: "manual"
                },
                retention: {
                    numberOfDays: 36500
                },

                state: {
                },
            };
        }
        else
        {
            if(config.state.lastScheduleTime !== undefined)
                config.state.lastScheduleTime = DateTime.ConstructFromISOString(config.state.lastScheduleTime as any);
        }

        return config;
    }

    public async RemoveDatabaseSource(resourceReference: LightweightResourceReference, externalId: string, databaseName: string)
    {
        const config = await this.ReadConfig(resourceReference.id);

        const idx = config.sources.databases.findIndex(x => x.externalId === externalId);
        config.sources.databases.Remove(idx);

        await this.WriteConfig(resourceReference.id, config);
    }

    public async RemoveFileStorageSource(resourceReference: LightweightResourceReference, externalId: string)
    {
        const config = await this.ReadConfig(resourceReference.id);

        const idx = config.sources.fileStorages.findIndex(x => x.externalId === externalId);
        config.sources.fileStorages.Remove(idx);

        await this.WriteConfig(resourceReference.id, config);
    }

    public async RemoveKeyVaultSource(resourceReference: LightweightResourceReference, resourceId: number)
    {
        const config = await this.ReadConfig(resourceReference.id);

        const idx = config.sources.keyVaults.findIndex(x => x.resourceId === resourceId);
        config.sources.keyVaults.Remove(idx);

        await this.WriteConfig(resourceReference.id, config);
    }

    public async RemoveObjectStorageSource(resourceReference: LightweightResourceReference, resourceId: number)
    {
        const config = await this.ReadConfig(resourceReference.id);

        const idx = config.sources.objectStorages.findIndex(x => x.resourceId === resourceId);
        config.sources.objectStorages.Remove(idx);

        await this.WriteConfig(resourceReference.id, config);
    }

    public async StartBackupProcess(instanceId: number)
    {
        const config = await this.ReadConfig(instanceId);
        try
        {
            await this.backupProcessService.RunBackup(instanceId, config.sources, config.target, config.retention);
        }
        catch(e)
        {
            this.failedBackups[instanceId] = true;
            throw e;
        }
        await this.backupProcessService.DeleteBackupsThatAreOlderThanRetentionPeriod(instanceId, config.sources, config.target, config.retention);

        this.failedBackups[instanceId] = false;
    }

    public async UpdateControllerDBSource(resourceReference: LightweightResourceReference, source: BackupVaultControllerDatabaseConfig)
    {
        const config = await this.ReadConfig(resourceReference.id);
        config.sources.controllerDB = source;
        await this.WriteConfig(resourceReference.id, config);
    }

    public async UpdateRetentionConfig(resourceReference: LightweightResourceReference, targetConfig: BackupVaultRetentionConfig)
    {
        const config = await this.ReadConfig(resourceReference.id);
        config.retention = targetConfig;
        await this.WriteConfig(resourceReference.id, config);

        this.backupProcessService.DeleteBackupsThatAreOlderThanRetentionPeriod(resourceReference.id, config.sources, config.target, config.retention);
    }

    public async UpdateTargetConfig(resourceReference: LightweightResourceReference, targetConfig: BackupVaultTargetConfig)
    {
        const config = await this.ReadConfig(resourceReference.id);
        config.target = targetConfig;
        await this.WriteConfig(resourceReference.id, config);
    }

    public async UpdateTriggerConfig(resourceReference: LightweightResourceReference, targetConfig: BackupVaultTrigger)
    {
        const config = await this.ReadConfig(resourceReference.id);
        config.trigger = targetConfig;
        await this.WriteConfig(resourceReference.id, config);

        this.EnsureBackupTimerIsRunningIfConfigured(resourceReference.id);
    }

    //State
    private failedBackups: NumberDictionary<boolean>;

    //Private methods
    private async WriteConfig(resourceId: number, config: BackupVaultConfig)
    {
        const obj = {
            sources: config.sources,
            target: config.target,
            trigger: config.trigger,
            retention: config.retention,
            state: {
                lastScheduleTime: (config.state.lastScheduleTime === undefined) ? undefined : config.state.lastScheduleTime.ToISOString()
            }
        };
        await this.resourceConfigController.UpdateOrInsertConfig(resourceId, obj);

        await this.UpdateResourceDependencies(resourceId, config);
    }

    private async UpdateResourceDependencies(resourceId: number, config: BackupVaultConfig)
    {
        const dependencies = [];

        //TODO: convert all the other external ids to internal ones when storing data
        dependencies.push(...config.sources.keyVaults.map(x => x.resourceId));
        dependencies.push(...config.sources.objectStorages.map(x => x.resourceId));

        if(config.target.type === "webdav")
        {
            dependencies.push(config.target.password.keyVaultResourceId);
            if(config.target.encryptionKey !== undefined)
                dependencies.push(config.target.encryptionKey.keyVaultResourceId);
        }

        await this.resourceDependenciesController.SetResourceDependencies(resourceId, dependencies);
    }

    //Event handlers
    private async OnAutomaticBackupTrigger(resourceId: number)
    {
        await this.StartBackupProcess(resourceId);

        const config = await this.ReadConfig(resourceId);
        config.state.lastScheduleTime = DateTime.Now();
        await this.WriteConfig(resourceId, config);
        
        this.EnsureBackupTimerIsRunningIfConfigured(resourceId);
    }
}