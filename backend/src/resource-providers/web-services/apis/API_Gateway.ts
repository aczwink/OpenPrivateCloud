/**
 * OpenPrivateCloud
 * Copyright (C) 2019-2025 Amir Czwink (amir130@hotmail.de)
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

import { ResourceAPIControllerBase } from "../../ResourceAPIControllerBase";
import { APIController, Body, BodyProp, Common, Delete, Get, NotFound, Path, Post, Put } from "acts-util-apilib";
import { ResourcesManager } from "../../../services/ResourcesManager";
import { ResourceReference } from "../../../common/ResourceReference";
import { c_apiGatewayResourceTypeName, c_webServicesResourceProviderName } from "openprivatecloud-common/dist/constants";
import { API_EntryConfig, API_GatewayManager } from "../API_GatewayManager";
import { DockerContainerLogDto } from "../../compute-services/api/docker-container-app-service";
import { KeyVaultManager } from "../../security-services/KeyVaultManager";
import { Of } from "acts-util-core";

interface AppGatewayRoutingRuleDTO
{
    /**
     * Set to enforce https traffic or to override the default certificate
     * @title Certificate
     * @format key-vault-reference[certificate]
     */
    keyVaultCertificateReference?: string;

    /**
     * Important: If you specify a path, the request path will be URL-decoded. To avoid that, specify only a host i.e. https://10.0.0.1:443 (notice the missing trailing slash).
     */
    backendURL: string;

    frontendDomainName: string;

    /**
     * Define only if you want to override the service configuration value.
     * @format byteSize
     */
    maxRequestBodySize?: number;
}

interface API_GatewaySettingsDTO
{
    /**
     * Set to enforce https traffic
     * @title Certificate
     * @format key-vault-reference[certificate]
     */
    keyVaultCertificateReference?: string;

    frontendPorts: number[];

    /**
     * @format byteSize
     */
    maxRequestBodySize: number;

    /**
     * @title Virtual network
     * @format resource-same-host[network-services/virtual-network]
     */
    vnetResourceId: string;
}

@APIController(`resourceProviders/{resourceGroupName}/${c_webServicesResourceProviderName}/${c_apiGatewayResourceTypeName}/{resourceName}`)
class _api_ extends ResourceAPIControllerBase
{
    constructor(resourcesManager: ResourcesManager, private apiGatewayManager: API_GatewayManager, private keyVaultManager: KeyVaultManager)
    {
        super(resourcesManager, c_webServicesResourceProviderName, c_apiGatewayResourceTypeName);
    }

    @Common()
    public async ExtractCommonAPIData(
        @Path resourceGroupName: string,
        @Path resourceName: string
    )
    {
        return this.FetchResourceReference(resourceGroupName, resourceName);
    }

    @Post("apis")
    public async AddAPI(
        @Common resourceReference: ResourceReference,
        @Body dto: AppGatewayRoutingRuleDTO
    )
    {
        const rule = await this.MapDTOToRule(dto);
        await this.apiGatewayManager.AddAPI(resourceReference, rule);
    }

    @Delete("apis")
    public async DeleteAPI(
        @Common resourceReference: ResourceReference,
        @Body api: AppGatewayRoutingRuleDTO
    )
    {
        const result = await this.apiGatewayManager.DeleteAPI(resourceReference, api);
        if(!result)
            return NotFound("API not found");
    }

    @Get("apis")
    public async QueryAPIs(
        @Common resourceReference: ResourceReference,
    )
    {
        const rules = await this.apiGatewayManager.QueryAPIs(resourceReference);
        return await rules.Values().Map(this.MapRuleToDTO.bind(this)).PromiseAll();
    }

    @Put("apis")
    public async UpdateAPI(
        @Common resourceReference: ResourceReference,
        @BodyProp oldFrontendDomainName: string,
        @BodyProp newProps: AppGatewayRoutingRuleDTO
    )
    {
        const rule = await this.MapDTOToRule(newProps);
        await this.apiGatewayManager.UpdateAPI(resourceReference, oldFrontendDomainName, rule);
    }

    @Get("info")
    public QueryInfo(
        @Common resourceReference: ResourceReference,
    )
    {
        return this.apiGatewayManager.QueryInfo(resourceReference);
    }

    @Get("log")
    public async QueryLog(
        @Common resourceReference: ResourceReference
    )
    {
        const log = await this.apiGatewayManager.QueryLog(resourceReference);

        const result: DockerContainerLogDto = {
            stdErr: log.stdErr,
            stdOut: log.stdOut
        };
        return result;
    }

    @Get("settings")
    public async QuerySettings(
        @Common resourceReference: ResourceReference,
    )
    {
        const settings = await this.apiGatewayManager.QuerySettings(resourceReference);

        const vnetRef = await this.resourcesManager.CreateResourceReference(settings.vnetResourceId);
        const certRef = (settings.certificate === undefined) ? undefined : await this.keyVaultManager.CreateKeyVaultReference(settings.certificate.keyVaultId, "certificate", settings.certificate.certificateName);

        return Of<API_GatewaySettingsDTO>({
            frontendPorts: settings.frontendPorts,
            maxRequestBodySize: settings.maxRequestBodySize,
            vnetResourceId: vnetRef!.externalId,
            keyVaultCertificateReference: certRef
        });
    }

    @Put("settings")
    public async UpdateServerSettings(
        @Common resourceReference: ResourceReference,
        @Body settings: API_GatewaySettingsDTO
    )
    {
        const vnetRef = await this.resourcesManager.CreateResourceReferenceFromExternalId(settings.vnetResourceId);
        if(vnetRef === undefined)
            return NotFound("vnet not found");

        const certRef = (settings.keyVaultCertificateReference === undefined) ? undefined : await this.keyVaultManager.ResolveKeyVaultReference(settings.keyVaultCertificateReference);

        return this.apiGatewayManager.UpdateSettings(resourceReference, {
            frontendPorts: settings.frontendPorts,
            maxRequestBodySize: settings.maxRequestBodySize,
            vnetResourceId: vnetRef.id,
            certificate: (certRef === undefined) ? undefined : {
                certificateName: certRef.objectName,
                keyVaultId: certRef.kvRef.id
            }
        });
    }

    //Private methods
    private async MapDTOToRule(dto: AppGatewayRoutingRuleDTO): Promise<API_EntryConfig>
    {
        const certRef = (dto.keyVaultCertificateReference === undefined) ? undefined : await this.keyVaultManager.ResolveKeyVaultReference(dto.keyVaultCertificateReference);

        return {
            backendURL: dto.backendURL,
            certificate: (certRef === undefined) ? undefined : {
                certificateName: certRef.objectName,
                keyVaultId: certRef.kvRef.id
            },
            frontendDomainName: dto.frontendDomainName,
            maxRequestBodySize: dto.maxRequestBodySize
        }
    }

    private async MapRuleToDTO(rule: API_EntryConfig): Promise<AppGatewayRoutingRuleDTO>
    {
        const certRef = (rule.certificate === undefined) ? undefined : await this.keyVaultManager.CreateKeyVaultReference(rule.certificate.keyVaultId, "certificate", rule.certificate.certificateName);

        return {
            backendURL: rule.backendURL,
            frontendDomainName: rule.frontendDomainName,
            keyVaultCertificateReference: certRef,
            maxRequestBodySize: rule.maxRequestBodySize
        };
    }
}