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

import { APIController, Body, BodyProp, Common, FormField, Get, Path, Post, Put } from "acts-util-apilib";
import { UploadedFile } from "acts-util-node/dist/http/UploadedFile";
import { c_nodeAppServiceResourceTypeName, c_webServicesResourceProviderName } from "openprivatecloud-common/dist/constants";
import { ResourcesManager } from "../../../services/ResourcesManager";
import { NodeAppServiceConfig, NodeAppServiceManager, NodeEnvironmentVariableMapping } from "../NodeAppServiceManager";
import { ResourceAPIControllerBase } from "../../ResourceAPIControllerBase";
import { ResourceReference } from "../../../common/ResourceReference";
import { NodeAppServiceConfigDTO, NodeEnvironmentVariableMappingDTO } from "./DTOs";
import { KeyVaultManager } from "../../security-services/KeyVaultManager";

interface NodeAppServiceInfoDto
{
    hostName: string;
    storagePath: string;
    isRunning: boolean;
}

interface NodeAppServiceStatus
{
    isRunning: boolean;
    /**
     * @format multi-line
     */
    status: string;
}

@APIController(`resourceProviders/{resourceGroupName}/${c_webServicesResourceProviderName}/${c_nodeAppServiceResourceTypeName}/{resourceName}`)
class _api_ extends ResourceAPIControllerBase
{
    constructor(resourcesManager: ResourcesManager, private nodeAppServiceManager: NodeAppServiceManager, private keyVaultManager: KeyVaultManager)
    {
        super(resourcesManager, c_webServicesResourceProviderName, c_nodeAppServiceResourceTypeName);
    }
    
    @Common()
    public async ExtractCommonAPIData(
        @Path resourceGroupName: string,
        @Path resourceName: string
    )
    {
        return this.FetchResourceReference(resourceGroupName, resourceName);
    }

    @Get("config")
    public async QueryConfig(
        @Common resourceReference: ResourceReference,
    )
    {
        const config = await this.nodeAppServiceManager.QueryConfig(resourceReference);
        return this.MapConfigToDTO(config);
    }

    @Put("config")
    public async UpdateConfig(
        @Common resourceReference: ResourceReference,
        @Body config: NodeAppServiceConfigDTO
    )
    {
        const realConfig = await this.MapConfigFromDTO(config);
        return this.nodeAppServiceManager.UpdateConfig(resourceReference, realConfig);
    }

    @Get("info")
    public async QueryInfo(
        @Common resourceReference: ResourceReference,
    )
    {            
        const result: NodeAppServiceInfoDto = {
            hostName: resourceReference.hostName,
            storagePath: resourceReference.hostStoragePath,
            isRunning: await this.nodeAppServiceManager.IsAppServiceRunning(resourceReference),
        };
        return result;
    }

    @Get("status")
    public async QueryStatus(
        @Common resourceReference: ResourceReference,
    )
    {
        const result: NodeAppServiceStatus = {
            isRunning: await this.nodeAppServiceManager.IsAppServiceRunning(resourceReference),
            status: await this.nodeAppServiceManager.QueryStatus(resourceReference)
        };
        return result;
    }

    @Post("startStop")
    public async StartOrStopService(
        @Common resourceReference: ResourceReference,
        @BodyProp action: "start" | "stop"
    )
    {
        await this.nodeAppServiceManager.ExecuteAction(resourceReference, action);
    }

    @Post()
    public async UpdateContent(
        @Common resourceReference: ResourceReference,
        @FormField file: UploadedFile
    )
    {
        await this.nodeAppServiceManager.UpdateContent(resourceReference, file.buffer);
    }

    //Private methods
    private async MapConfigFromDTO(dto: NodeAppServiceConfigDTO): Promise<NodeAppServiceConfig>
    {
        return {
            autoStart: dto.autoStart,
            env: await dto.env.Values().Map(this.MapEnvFromDTO.bind(this)).PromiseAll()
        };
    }

    private async MapConfigToDTO(config: NodeAppServiceConfig): Promise<NodeAppServiceConfigDTO>
    {
        return {
            autoStart: config.autoStart,
            env: await config.env.Values().Map(this.MapEnvToDTO.bind(this)).PromiseAll()
        };
    }

    private async MapEnvFromDTO(dto: NodeEnvironmentVariableMappingDTO): Promise<NodeEnvironmentVariableMapping>
    {
        switch(dto.value.type)
        {
            case "keyvault-secret":
            {
                const ref = await this.keyVaultManager.ResolveKeyVaultReference(dto.value.keyVaultSecretReference);
                return {
                    value: {
                        type: "keyvault-secret",
                        keyVaultResourceId: ref.kvRef.id,
                        secretName: ref.objectName
                    },
                    varName: dto.varName
                };
            }
            case "string":
                return {
                    value: {
                        type: "string",
                        value: dto.value.value
                    },
                    varName: dto.varName
                };
        }
    }

    private async MapEnvToDTO(env: NodeEnvironmentVariableMapping): Promise<NodeEnvironmentVariableMappingDTO>
    {
        switch(env.value.type)
        {
            case "keyvault-secret":
                return {
                    value: {
                        type: "keyvault-secret",
                        keyVaultSecretReference: await this.keyVaultManager.CreateKeyVaultReference(env.value.keyVaultResourceId, "secret", env.value.secretName)
                    },
                    varName: env.varName
                };
            case "string":
                return {
                    value: {
                        type: "string",
                        value: env.value.value
                    },
                    varName: env.varName
                };
        }
    }
}