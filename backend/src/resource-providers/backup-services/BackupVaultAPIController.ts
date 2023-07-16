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
import { c_backupServicesResourceProviderName, c_backupVaultResourceTypeName } from "openprivatecloud-common/dist/constants";
import { HostsController } from "../../data-access/HostsController";
import { HostStoragesController } from "../../data-access/HostStoragesController";
import { ResourcesController } from "../../data-access/ResourcesController";
import { ResourcesManager } from "../../services/ResourcesManager";
import { BackupVaultManager } from "./BackupVaultManager";
import { BackupVaultDatabaseConfig, BackupVaultFileStorageConfig, BackupVaultRetentionConfig, BackupVaultTargetConfig, BackupVaultTrigger } from "./models";
import { BackupProcessService } from "./BackupProcessService";

interface BackupVaultDeploymentDataDto
{
    hostName: string;
}

type BackupVaultAnySourceConfigDto = BackupVaultFileStorageConfig | BackupVaultDatabaseConfig;

@APIController(`resourceProviders/{resourceGroupName}/${c_backupServicesResourceProviderName}/${c_backupVaultResourceTypeName}/{instanceName}`)
class BackupVaultAPIController
{
    constructor(private instancesController: ResourcesController, private instancesManager: ResourcesManager, private backupVaultManager: BackupVaultManager,
        private hostStoragesController: HostStoragesController, private hostsController: HostsController,
        private backupProcessService: BackupProcessService)
    {
    }

    @Common()
    public async ExtractCommonAPIData(
        @Path resourceGroupName: string,
        @Path instanceName: string
    )
    {
        throw new Error("TODO: reimplement me");
        /*const fullInstanceName = this.instancesManager.TODO_DEPRECATED_CreateUniqueInstanceName(c_backupServicesResourceProviderName, c_backupVaultResourceTypeName, instanceName);
        const instance = await this.instancesController.QueryResourceByName(fullInstanceName);
        if(instance === undefined)
            return NotFound("instance not found");

        return instance.id;
        */
    }

    @Post("sources")
    public async AddSource(
        @Common instanceId: number,
        @Body source: BackupVaultAnySourceConfigDto
    )
    {
        const config = await this.backupVaultManager.ReadConfig(instanceId);
        if("createSnapshotBeforeBackup" in source)
            config.sources.fileStorages.push(source);
        else
            config.sources.databases.push(source);
        await this.backupVaultManager.WriteConfig(instanceId, config);
    }

    @Delete("sources")
    public async DeleteSource(
        @Common instanceId: number,
        @BodyProp fullInstanceSourceName: string
    )
    {
        const config = await this.backupVaultManager.ReadConfig(instanceId);

        const idx = config.sources.fileStorages.findIndex(x => x.fullInstanceName === fullInstanceSourceName);
        if(idx === -1)
        {
            const idx = config.sources.databases.findIndex(x => x.fullInstanceName === fullInstanceSourceName);
            config.sources.databases.Remove(idx);
        }
        else
        {
            config.sources.fileStorages.Remove(idx);
        }

        await this.backupVaultManager.WriteConfig(instanceId, config);
    }

    @Get("deploymentdata")
    public async QueryDeploymentData(
        @Common instanceId: number,
    )
    {
        const instance = await this.instancesController.QueryResource(instanceId);
        const storage = await this.hostStoragesController.RequestHostStorage(instance!.storageId);
        const host = await this.hostsController.RequestHostCredentials(storage!.hostId);

        const result: BackupVaultDeploymentDataDto = {
            hostName: host!.hostName,
        };
        return result;
    }

    @Get("retention")
    public async QueryRetentionConfig(
        @Common instanceId: number
    )
    {
        const config = await this.backupVaultManager.ReadConfig(instanceId);
        return config.retention;
    }
    
    @Get("sources")
    public async QuerySourcesConfig(
        @Common instanceId: number
    )
    {
        const config = await this.backupVaultManager.ReadConfig(instanceId);
        return config.sources;
    }

    @Get("target")
    public async QueryTargetConfig(
        @Common instanceId: number
    )
    {
        const config = await this.backupVaultManager.ReadConfig(instanceId);
        return config.target;
    }

    @Get("trigger")
    public async QueryTriggerConfig(
        @Common instanceId: number
    )
    {
        const config = await this.backupVaultManager.ReadConfig(instanceId);
        return config.trigger;
    }

    @Post()
    public async StartBackupProcess(
        @Common instanceId: number
    )
    {
        this.backupVaultManager.StartBackupProcess(instanceId);
    }

    @Put("retention")
    public async UpdateRetentionConfig(
        @Common instanceId: number,
        @Body targetConfig: BackupVaultRetentionConfig
    )
    {
        const config = await this.backupVaultManager.ReadConfig(instanceId);
        config.retention = targetConfig;
        await this.backupVaultManager.WriteConfig(instanceId, config);

        this.backupProcessService.DeleteBackupsThatAreOlderThanRetentionPeriod(instanceId, config.sources, config.target, config.retention);
    }

    @Put("target")
    public async UpdateTargetConfig(
        @Common instanceId: number,
        @Body targetConfig: BackupVaultTargetConfig
    )
    {
        const config = await this.backupVaultManager.ReadConfig(instanceId);
        config.target = targetConfig;
        await this.backupVaultManager.WriteConfig(instanceId, config);
    }

    @Put("trigger")
    public async UpdateTriggerConfig(
        @Common instanceId: number,
        @Path instanceName: string,
        @Body targetConfig: BackupVaultTrigger
    )
    {
        const config = await this.backupVaultManager.ReadConfig(instanceId);
        config.trigger = targetConfig;
        await this.backupVaultManager.WriteConfig(instanceId, config);

        const fullInstanceName = this.instancesManager.TODO_DEPRECATED_CreateUniqueInstanceName(c_backupServicesResourceProviderName, c_backupVaultResourceTypeName, instanceName);
        this.backupVaultManager.EnsureBackupTimerIsRunningIfConfigured(fullInstanceName);
    }
}