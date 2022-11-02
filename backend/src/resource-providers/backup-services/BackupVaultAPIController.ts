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

import { APIController, Body, BodyProp, Common, Delete, Get, NotFound, Path, Post, Put } from "acts-util-apilib";
import { c_backupServicesResourceProviderName, c_backupVaultResourceTypeName } from "openprivatecloud-common/dist/constants";
import { HostsController } from "../../data-access/HostsController";
import { HostStoragesController } from "../../data-access/HostStoragesController";
import { InstancesController } from "../../data-access/InstancesController";
import { InstancesManager } from "../../services/InstancesManager";
import { BackupVaultManager } from "./BackupVaultManager";
import { BackupVaultFileStorageConfig, BackupVaultTargetConfig } from "./models";

interface BackupVaultDeploymentDataDto
{
    hostName: string;
}

@APIController(`resourceProviders/${c_backupServicesResourceProviderName}/${c_backupVaultResourceTypeName}/{instanceName}`)
class BackupVaultAPIController
{
    constructor(private instancesController: InstancesController, private instancesManager: InstancesManager, private backupVaultManager: BackupVaultManager,
        private hostStoragesController: HostStoragesController, private hostsController: HostsController)
    {
    }

    @Common()
    public async ExtractCommonAPIData(
        @Path instanceName: string
    )
    {
        const fullInstanceName = this.instancesManager.CreateUniqueInstanceName(c_backupServicesResourceProviderName, c_backupVaultResourceTypeName, instanceName);
        const instance = await this.instancesController.QueryInstance(fullInstanceName);
        if(instance === undefined)
            return NotFound("instance not found");

        return instance.id;
    }

    @Post("fileStorages")
    public async AddFileStorageSource(
        @Common instanceId: number,
        @Body source: BackupVaultFileStorageConfig
    )
    {
        const config = await this.backupVaultManager.ReadConfig(instanceId);
        config.sources.fileStorages.push(source);
        await this.backupVaultManager.WriteConfig(instanceId, config);
    }

    @Get("deploymentdata")
    public async QueryDeploymentData(
        @Common instanceId: number,
    )
    {
        const instance = await this.instancesController.QueryInstanceById(instanceId);
        const storage = await this.hostStoragesController.RequestHostStorage(instance!.storageId);
        const host = await this.hostsController.RequestHostCredentials(storage!.hostId);

        const result: BackupVaultDeploymentDataDto = {
            hostName: host!.hostName,
        };
        return result;
    }

    @Delete("fileStorages")
    public async DeleteFileStorageSource(
        @Common instanceId: number,
        @BodyProp fullInstanceSourceName: string
    )
    {
        const config = await this.backupVaultManager.ReadConfig(instanceId);

        const idx = config.sources.fileStorages.findIndex(x => x.fullInstanceName === fullInstanceSourceName);
        config.sources.fileStorages.Remove(idx);

        await this.backupVaultManager.WriteConfig(instanceId, config);
    }
    
    @Get("fileStorages")
    public async QueryFileStoragesConfig(
        @Common instanceId: number
    )
    {
        const config = await this.backupVaultManager.ReadConfig(instanceId);
        return config.sources.fileStorages;
    }

    @Get("target")
    public async QueryTargetConfig(
        @Common instanceId: number
    )
    {
        const config = await this.backupVaultManager.ReadConfig(instanceId);
        return config.target;
    }

    @Post()
    public async StartBackupProcess(
        @Common instanceId: number
    )
    {
        this.backupVaultManager.StartBackupProcess(instanceId);
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
}