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

import { APIController, Body, BodyProp, Common, Delete, Get, Path, Post, Put } from "acts-util-apilib";
import { c_backupServicesResourceProviderName, c_backupVaultResourceTypeName } from "openprivatecloud-common/dist/constants";
import { ResourcesManager } from "../../services/ResourcesManager";
import { BackupVaultManager } from "./BackupVaultManager";
import { BackupVaultDatabaseConfig, BackupVaultFileStorageConfig, BackupVaultRetentionConfig, BackupVaultTargetConfig, BackupVaultTrigger } from "./models";
import { BackupProcessService } from "./BackupProcessService";
import { ResourceAPIControllerBase } from "../ResourceAPIControllerBase";
import { ResourceReference } from "../../common/ResourceReference";

interface BackupVaultDeploymentDataDto
{
    hostName: string;
}

type BackupVaultAnySourceConfigDto = BackupVaultFileStorageConfig | BackupVaultDatabaseConfig;

@APIController(`resourceProviders/{resourceGroupName}/${c_backupServicesResourceProviderName}/${c_backupVaultResourceTypeName}/{resourceName}`)
class BackupVaultAPIController extends ResourceAPIControllerBase
{
    constructor(resourcesManager: ResourcesManager, private backupVaultManager: BackupVaultManager, private backupProcessService: BackupProcessService)
    {
        super(resourcesManager, c_backupServicesResourceProviderName, c_backupVaultResourceTypeName);
    }

    @Common()
    public async ExtractCommonAPIData(
        @Path resourceGroupName: string,
        @Path resourceName: string
    )
    {
        return this.FetchResourceReference(resourceGroupName, resourceName);
    }

    @Post("sources")
    public async AddSource(
        @Common resourceReference: ResourceReference,
        @Body source: BackupVaultAnySourceConfigDto
    )
    {
        const config = await this.backupVaultManager.ReadConfig(resourceReference.id);
        if("createSnapshotBeforeBackup" in source)
            config.sources.fileStorages.push(source);
        else
            config.sources.databases.push(source);
        await this.backupVaultManager.WriteConfig(resourceReference.id, config);
    }

    @Delete("sources")
    public async DeleteSource(
        @Common resourceReference: ResourceReference,
        @BodyProp sourceResourceId: string
    )
    {
        const config = await this.backupVaultManager.ReadConfig(resourceReference.id);

        const idx = config.sources.fileStorages.findIndex(x => x.externalId === sourceResourceId);
        if(idx === -1)
        {
            const idx = config.sources.databases.findIndex(x => (x.externalId === sourceResourceId));
            config.sources.databases.Remove(idx);
        }
        else
        {
            config.sources.fileStorages.Remove(idx);
        }

        await this.backupVaultManager.WriteConfig(resourceReference.id, config);
    }

    @Get("deploymentdata")
    public async QueryDeploymentData(
        @Common resourceReference: ResourceReference,
    )
    {
        const result: BackupVaultDeploymentDataDto = {
            hostName: resourceReference.hostName,
        };
        return result;
    }

    @Get("retention")
    public async QueryRetentionConfig(
        @Common resourceReference: ResourceReference,
    )
    {
        const config = await this.backupVaultManager.ReadConfig(resourceReference.id);
        return config.retention;
    }
    
    @Get("sources")
    public async QuerySourcesConfig(
        @Common resourceReference: ResourceReference,
    )
    {
        const config = await this.backupVaultManager.ReadConfig(resourceReference.id);
        return config.sources;
    }

    @Get("target")
    public async QueryTargetConfig(
        @Common resourceReference: ResourceReference,
    )
    {
        const config = await this.backupVaultManager.ReadConfig(resourceReference.id);
        return config.target;
    }

    @Get("trigger")
    public async QueryTriggerConfig(
        @Common resourceReference: ResourceReference,
    )
    {
        const config = await this.backupVaultManager.ReadConfig(resourceReference.id);
        return config.trigger;
    }

    @Post()
    public async StartBackupProcess(
        @Common resourceReference: ResourceReference,
    )
    {
        this.backupVaultManager.StartBackupProcess(resourceReference.id);
    }

    @Put("retention")
    public async UpdateRetentionConfig(
        @Common resourceReference: ResourceReference,
        @Body targetConfig: BackupVaultRetentionConfig
    )
    {
        const config = await this.backupVaultManager.ReadConfig(resourceReference.id);
        config.retention = targetConfig;
        await this.backupVaultManager.WriteConfig(resourceReference.id, config);

        this.backupProcessService.DeleteBackupsThatAreOlderThanRetentionPeriod(resourceReference.id, config.sources, config.target, config.retention);
    }

    @Put("target")
    public async UpdateTargetConfig(
        @Common resourceReference: ResourceReference,
        @Body targetConfig: BackupVaultTargetConfig
    )
    {
        const config = await this.backupVaultManager.ReadConfig(resourceReference.id);
        config.target = targetConfig;
        await this.backupVaultManager.WriteConfig(resourceReference.id, config);
    }

    @Put("trigger")
    public async UpdateTriggerConfig(
        @Common resourceReference: ResourceReference,
        @Body targetConfig: BackupVaultTrigger
    )
    {
        const config = await this.backupVaultManager.ReadConfig(resourceReference.id);
        config.trigger = targetConfig;
        await this.backupVaultManager.WriteConfig(resourceReference.id, config);

        this.backupVaultManager.EnsureBackupTimerIsRunningIfConfigured(resourceReference.id);
    }
}