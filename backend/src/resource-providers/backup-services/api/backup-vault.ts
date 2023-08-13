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

import { APIController, Body, Common, Delete, Get, NotFound, Path, Post, Put } from "acts-util-apilib";
import { c_backupServicesResourceProviderName, c_backupVaultResourceTypeName } from "openprivatecloud-common/dist/constants";
import { ResourcesManager } from "../../../services/ResourcesManager";
import { BackupVaultManager } from "../BackupVaultManager";
import { BackupVaultControllerDatabaseConfig, BackupVaultRetentionConfig, BackupVaultTargetConfig, BackupVaultTrigger } from "../models";
import { ResourceAPIControllerBase } from "../../ResourceAPIControllerBase";
import { ResourceReference } from "../../../common/ResourceReference";
import { BackupVaultAnySourceConfigDTO, BackupVaultSourcesDTO, BackupVaultTargetConfigDTO } from "./DTOs";
import { KeyVaultManager } from "../../security-services/KeyVaultManager";

interface BackupVaultDeploymentDataDto
{
    hostName: string;
}

@APIController(`resourceProviders/{resourceGroupName}/${c_backupServicesResourceProviderName}/${c_backupVaultResourceTypeName}/{resourceName}`)
class _api_ extends ResourceAPIControllerBase
{
    constructor(resourcesManager: ResourcesManager, private backupVaultManager: BackupVaultManager, private keyVaultManager: KeyVaultManager)
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

    @Post("sources")
    public async AddSource(
        @Common resourceReference: ResourceReference,
        @Body source: BackupVaultAnySourceConfigDTO
    )
    {
        if("createSnapshotBeforeBackup" in source)
            await this.backupVaultManager.AddFileStorageSource(resourceReference, source);
        else if("databaseName" in source)
            await this.backupVaultManager.AddDatabaseSource(resourceReference, source);
        else
        {
            const kvRef = await this.resourcesManager.CreateResourceReferenceFromExternalId(source.id);
            if(kvRef === undefined)
                return NotFound("Key vault not found");
            await this.backupVaultManager.AddKeyVaultSource(resourceReference, { resourceId: kvRef.id});
        }
    }

    @Delete("sources")
    public async DeleteSource(
        @Common resourceReference: ResourceReference,
        @Body source: BackupVaultAnySourceConfigDTO
    )
    {
        if("createSnapshotBeforeBackup" in source)
            await this.backupVaultManager.RemoveFileStorageSource(resourceReference, source.externalId);
        else if("databaseName" in source)
            await this.backupVaultManager.RemoveDatabaseSource(resourceReference, source.externalId, source.databaseName);
        else
        {
            const kvRef = await this.resourcesManager.CreateResourceReferenceFromExternalId(source.id);
            if(kvRef === undefined)
                return NotFound("Key vault not found");
            await this.backupVaultManager.RemoveKeyVaultSource(resourceReference, kvRef.id);
        }
    }
    
    @Get("sources")
    public async QuerySourcesConfig(
        @Common resourceReference: ResourceReference,
    )
    {
        const config = await this.backupVaultManager.ReadConfig(resourceReference.id);
        const sources: BackupVaultSourcesDTO = {
            controllerDB: config.sources.controllerDB,
            databases: config.sources.databases,
            fileStorages: config.sources.fileStorages,
            keyVaults: await config.sources.keyVaults.Values().Map(x => this.resourcesManager.CreateResourceReference(x.resourceId)).MapAsync(x => ({ id: x!.externalId })).PromiseAll()
        };
        return sources;
    }

    @Put("sources")
    public async UpdateControllerDBSource(
        @Common resourceReference: ResourceReference,
        @Body source: BackupVaultControllerDatabaseConfig
    )
    {
        await this.backupVaultManager.UpdateControllerDBSource(resourceReference, source);
    }

    @Get("target")
    public async QueryTargetConfig(
        @Common resourceReference: ResourceReference,
    )
    {
        const config = await this.backupVaultManager.ReadConfig(resourceReference.id);
        if(config.target.type === "storage-device")
            return config.target;
        const result: BackupVaultTargetConfigDTO = {
            type: "webdav",
            passwordKeyVaultSecretReference: await this.keyVaultManager.CreateKeyVaultReference(config.target.password.keyVaultResourceId, "secret", config.target.password.secretName),
            rootPath: config.target.rootPath,
            serverURL: config.target.serverURL,
            userName: config.target.userName,
            encryptionKeyKeyVaultReference: (config.target.encryptionKey === undefined) ? undefined : await this.keyVaultManager.CreateKeyVaultReference(config.target.encryptionKey.keyVaultResourceId, "key", config.target.encryptionKey.keyName),
        };
        return result;
    }

    @Put("target")
    public async UpdateTargetConfig(
        @Common resourceReference: ResourceReference,
        @Body targetConfig: BackupVaultTargetConfigDTO
    )
    {
        await this.backupVaultManager.UpdateTargetConfig(resourceReference, await this.MapTargetConfigDTO(targetConfig));
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
        await this.backupVaultManager.UpdateRetentionConfig(resourceReference, targetConfig);
    }

    @Put("trigger")
    public async UpdateTriggerConfig(
        @Common resourceReference: ResourceReference,
        @Body targetConfig: BackupVaultTrigger
    )
    {
        await this.backupVaultManager.UpdateTriggerConfig(resourceReference, targetConfig);
    }

    //Private methods
    private async MapTargetConfigDTO(dto: BackupVaultTargetConfigDTO): Promise<BackupVaultTargetConfig>
    {
        if(dto.type === "storage-device")
            return dto;

        const pw = await this.keyVaultManager.ResolveKeyVaultReference(dto.passwordKeyVaultSecretReference);
        const encryptionKey = (dto.encryptionKeyKeyVaultReference === undefined) ? undefined : await this.keyVaultManager.ResolveKeyVaultReference(dto.encryptionKeyKeyVaultReference);

        return {
            type: "webdav",
            password: {
                keyVaultResourceId: pw.kvRef.id,
                secretName: pw.objectName
            },
            rootPath: dto.rootPath,
            serverURL: dto.serverURL,
            userName: dto.userName,
            encryptionKey: (encryptionKey === undefined) ? undefined : {
                keyName: encryptionKey.objectName,
                keyVaultResourceId: encryptionKey.kvRef.id,
            }
        };
    }
}