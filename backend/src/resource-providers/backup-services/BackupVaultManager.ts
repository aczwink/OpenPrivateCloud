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

import { Injectable } from "acts-util-node";
import { InstanceConfigController } from "../../data-access/InstanceConfigController";
import { InstancesController } from "../../data-access/InstancesController";
import { TaskSchedulingManager } from "../../services/TaskSchedulingManager";
import { BackupProcessService } from "./BackupProcessService";
import { BackupVaultRetentionConfig, BackupVaultSourcesConfig, BackupVaultTargetConfig, BackupVaultTrigger } from "./models";

interface BackupVaultConfig
{
    sources: BackupVaultSourcesConfig;
    target: BackupVaultTargetConfig;
    trigger: BackupVaultTrigger;
    retention: BackupVaultRetentionConfig;

    state: {
        lastScheduleTime?: Date;
    };
}

@Injectable
export class BackupVaultManager
{
    constructor(private instanceConfigController: InstanceConfigController, private backupProcessService: BackupProcessService,
        private instancesController: InstancesController, private taskSchedulingManager: TaskSchedulingManager)
    {
    }

    //Public methods
    public async EnsureBackupTimerIsRunningIfConfigured(fullInstanceName: string)
    {
        const instance = await this.instancesController.QueryInstance(fullInstanceName);
        const instanceId = instance!.id;

        const config = await this.ReadConfig(instanceId);
        if(config.trigger.type === "automatic")
        {
            const lastScheduleTime = config.state.lastScheduleTime ?? new Date(0);
            this.taskSchedulingManager.ScheduleForInstance(fullInstanceName, lastScheduleTime, config.trigger.schedule, this.OnAutomaticBackupTrigger.bind(this, instanceId, fullInstanceName));
        }
    }

    public async ReadConfig(instanceId: number): Promise<BackupVaultConfig>
    {
        const config = await this.instanceConfigController.QueryConfig<BackupVaultConfig>(instanceId);

        if(config === undefined)
        {
            return {
                sources: {
                    databases: [],
                    fileStorages: []
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
                config.state.lastScheduleTime = new Date(config.state.lastScheduleTime);
        }

        return config;
    }

    public async StartBackupProcess(instanceId: number)
    {
        const config = await this.ReadConfig(instanceId);
        await this.backupProcessService.RunBackup(instanceId, config.sources, config.target);
        await this.backupProcessService.DeleteBackupsThatAreOlderThanRetentionPeriod(instanceId, config.sources, config.target, config.retention);
    }

    public async WriteConfig(instanceId: number, config: BackupVaultConfig)
    {
        const obj = {
            sources: config.sources,
            target: config.target,
            trigger: config.trigger,
            retention: config.retention,
            state: {
                lastScheduleTime: (config.state.lastScheduleTime === undefined) ? undefined : config.state.lastScheduleTime.toISOString()
            }
        };
        await this.instanceConfigController.UpdateOrInsertConfig(instanceId, obj);
    }

    //Event handlers
    private async OnAutomaticBackupTrigger(instanceId: number, fullInstanceName: string)
    {
        await this.StartBackupProcess(instanceId);

        const config = await this.ReadConfig(instanceId);
        config.state.lastScheduleTime = new Date();
        await this.WriteConfig(instanceId, config);
        
        this.EnsureBackupTimerIsRunningIfConfigured(fullInstanceName);
    }
}