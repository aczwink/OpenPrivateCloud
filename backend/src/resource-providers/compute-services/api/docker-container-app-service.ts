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

import { APIController, Body, BodyProp, Common, Get, Path, Post, Put } from "acts-util-apilib";
import { c_computeServicesResourceProviderName, c_dockerContainerResourceTypeName } from "openprivatecloud-common/dist/constants";
import { ResourcesManager } from "../../../services/ResourcesManager";
import { ContainerAppServiceConfig, ContainerAppServiceManager } from "../ContainerAppServiceManager";
import { ResourceAPIControllerBase } from "../../ResourceAPIControllerBase";
import { ResourceReference } from "../../../common/ResourceReference";
import { ContainerAppServiceConfigDTO } from "./DTOs";
import { KeyVaultManager } from "../../security-services/KeyVaultManager";


interface DockerContainerInfo
{
    hostName: string;
    state: string;
    ipAddresses: string[];
}

export interface DockerContainerLogDto
{
    /**
     * @format multi-line
     */
    stdErr: string;

    /**
     * @format multi-line
     */
    stdOut: string;
}

@APIController(`resourceProviders/{resourceGroupName}/${c_computeServicesResourceProviderName}/${c_dockerContainerResourceTypeName}/{resourceName}`)
class _api_ extends ResourceAPIControllerBase
{
    constructor(instancesManager: ResourcesManager, private dockerContainerManager: ContainerAppServiceManager, private keyVaultManager: KeyVaultManager)
    {
        super(instancesManager, c_computeServicesResourceProviderName, c_dockerContainerResourceTypeName);
    }

    @Common()
    public async ExtractCommonAPIData(
        @Path resourceGroupName: string,
        @Path resourceName: string
    )
    {
        return this.FetchResourceReference(resourceGroupName, resourceName);
    }

    @Post()
    public async ExecuteContainerAction(
        @Common resourceReference: ResourceReference,
        @BodyProp action: "start" | "shutdown"
    )
    {
        await this.dockerContainerManager.ExecuteAction(resourceReference, action);
    }

    @Get("config")
    public async QueryContainerConfig(
        @Common resourceReference: ResourceReference
    )
    {
        const config = await this.dockerContainerManager.QueryContainerConfig(resourceReference.id);
        return this.MapConfigToDTO(config);
    }

    @Put("config")
    public async UpdateContainerConfig(
        @Common resourceReference: ResourceReference,
        @Body config: ContainerAppServiceConfigDTO
    )
    {
        const realConfig = await this.MapConfigFromDTO(config);
        return this.dockerContainerManager.UpdateContainerConfig(resourceReference.id, realConfig);
    }

    @Get("info")
    public async QueryContainerInfo(
        @Common resourceReference: ResourceReference
    )
    {            
        const data = await this.dockerContainerManager.InspectContainer(resourceReference);
        const result: DockerContainerInfo = {
            hostName: resourceReference.hostName,
            state: await this.dockerContainerManager.QueryContainerStatus(resourceReference),
            ipAddresses: (data === undefined) ? [] : data.NetworkSettings.Networks.Values().NotUndefined().Map(x => x.IPAddress).ToArray()
        };
        return result;
    }

    @Get("log")
    public async QueryLog(
        @Common resourceReference: ResourceReference
    )
    {
        const log = await this.dockerContainerManager.QueryLog(resourceReference);

        const result: DockerContainerLogDto = {
            stdErr: log.stdErr,
            stdOut: log.stdOut
        };
        return result;
    }

    @Post("update")
    public async UpdateContainerImage(
        @Common resourceReference: ResourceReference
    )
    {
        await this.dockerContainerManager.UpdateContainerImage(resourceReference);
    }

    //Private methods
    private async MapConfigFromDTO(dto: ContainerAppServiceConfigDTO): Promise<ContainerAppServiceConfig>
    {
        const vnetRef = await this.resourcesManager.CreateResourceReferenceFromExternalId(dto.vnetResourceId);
        const certRef = (dto.certificate === undefined) ? undefined : await this.keyVaultManager.ResolveKeyVaultReference(dto.certificate.keyVaultCertificateReference)

        return {
            env: dto.env,
            imageName: dto.imageName,
            secrets: await dto.secrets.Values().Map(async x => {
                const resolved = await this.keyVaultManager.ResolveKeyVaultReference(x.keyVaultSecretReference);
                return {
                    keyVaultId: resolved.kvRef.id,
                    keyVaultSecretName: resolved.objectName,
                    mountPointSecretName: x.mountPointSecretName
                };
            }).PromiseAll(),
            vnetResourceId: vnetRef!.id,
            cert: (dto.certificate === undefined) ? undefined : {
                certificateMountPoint: dto.certificate.certificateMountPoint,
                certificateName: certRef!.objectName,
                keyVaultId: certRef!.kvRef.id,
                privateKeyMountPoint: dto.certificate.privateKeyMountPoint
            }
        }
    }

    private async MapConfigToDTO(config: ContainerAppServiceConfig): Promise<ContainerAppServiceConfigDTO>
    {
        const vnetRef = await this.resourcesManager.CreateResourceReference(config.vnetResourceId);

        return {
            certificate: (config.cert === undefined) ? undefined : {
                certificateMountPoint: config.cert.certificateMountPoint,
                keyVaultCertificateReference: await this.keyVaultManager.CreateKeyVaultReference(config.cert.keyVaultId, "certificate", config.cert.certificateName),
                privateKeyMountPoint: config.cert.privateKeyMountPoint
            },
            env: config.env,
            imageName: config.imageName,
            secrets: await config.secrets.Values().Map(async x => {
                const keyVaultSecretReference = await this.keyVaultManager.CreateKeyVaultReference(x.keyVaultId, "secret", x.keyVaultSecretName);

                return {
                    keyVaultSecretReference,
                    mountPointSecretName: x.mountPointSecretName
                };
            }).PromiseAll(),
            vnetResourceId: vnetRef!.externalId,
        }
    }
}