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
import { APIController, Body, Common, Delete, FormField, Get, NotFound, Path, Post } from "acts-util-apilib";
import { ResourcesManager } from "../../../services/ResourcesManager";
import { ResourceReference } from "../../../common/ResourceReference";
import { c_keyVaultResourceTypeName, c_securityServicesResourceProviderName } from "openprivatecloud-common/dist/constants";
import { KeyVaultKeyType, KeyVaultManager } from "../KeyVaultManager";
import { CA_Config } from "../EasyRSAManager";
import { HTTP } from "acts-util-node";

interface CertificateDTO
{
    type: "client" | "server";
    name: string;
}

interface CertificateImportDTO
{
    name: string;
    /**
     * @format multi-line
     */
    privateKey: string;
    /**
     * @format multi-line
     */
    cert: string;
}

interface KeyDTO
{
    name: string;
    type: KeyVaultKeyType;
}

interface KeyCreationDTO
{
    name: string;
    type: KeyVaultKeyType;
}

interface SecretDTO
{
    name: string;
    /**
     * @format secret
     */
    secretValue: string;
}

interface SecretListDTO
{
    name: string;
}

@APIController(`resourceProviders/{resourceGroupName}/${c_securityServicesResourceProviderName}/${c_keyVaultResourceTypeName}/{resourceName}`)
class _api_ extends ResourceAPIControllerBase
{
    constructor(resourcesManager: ResourcesManager, private keyVaultManager: KeyVaultManager)
    {
        super(resourcesManager, c_securityServicesResourceProviderName, c_keyVaultResourceTypeName);
    }

    @Common()
    public async ExtractCommonAPIData(
        @Path resourceGroupName: string,
        @Path resourceName: string
    )
    {
        return this.FetchResourceReference(resourceGroupName, resourceName);
    }

    @Post("certificates")
    public async CreateCertificate(
        @Common resourceReference: ResourceReference,
        @Body cert: CertificateDTO
    )
    {
        await this.keyVaultManager.GenerateCertificate(resourceReference, cert.type, cert.name);
    }

    @Post("certificates_import")
    public async ImportCertificate(
        @Common resourceReference: ResourceReference,
        @Body data: CertificateImportDTO,
    )
    {
        await this.keyVaultManager.ImportCertificate(resourceReference, data.name, data.privateKey, data.cert);
    }

    @Get("certificates")
    public QueryCertificates(
        @Common resourceReference: ResourceReference,
    )
    {
        return this.keyVaultManager.ListCertificates(resourceReference);
    }

    @Get("certificates/{name}")
    public async QueryCertificate(
        @Common resourceReference: ResourceReference,
        @Path name: string
    )
    {
        const cert = await this.keyVaultManager.ReadCertificateInfo(resourceReference, name);
        if(cert === undefined)
            return NotFound("Certificate does not exist");
        return cert;
    }

    @Delete("certificates/{name}")
    public async RevokeCertificate(
        @Common resourceReference: ResourceReference,
        @Path name: string
    )
    {
        await this.keyVaultManager.RevokeCertificate(resourceReference, name);
    }

    @Post("keys")
    public async CreateKey(
        @Common resourceReference: ResourceReference,
        @Body data: KeyCreationDTO
    )
    {
        await this.keyVaultManager.CreateKey(resourceReference, data.name, data.type);
    }

    @Get("keys")
    public async QueryKeys(
        @Common resourceReference: ResourceReference,
    )
    {
        const keys = await this.keyVaultManager.RequestKeys(resourceReference);
        return keys.map<KeyDTO>(x => ({
            name: x.name,
            type: x.type
        }));
    }

    @Get("keys/{keyName}")
    public async QueryKey(
        @Common resourceReference: ResourceReference,
        @Path keyName: string
    )
    {
        const x = await this.keyVaultManager.RequestKey(resourceReference, keyName);
        if(x === undefined)
            return NotFound("key not found");
        const dto: KeyDTO = {
            name: x.name,
            type: x.type
        };
        return dto;
    }

    @Post("keys/{keyName}/decrypt")
    public async Decrypt(
        @Common resourceReference: ResourceReference,
        @Path keyName: string,
        @FormField data: HTTP.UploadedFile
    )
    {
        const decrypted = await this.keyVaultManager.Decrypt(resourceReference, keyName, data.buffer);
        return decrypted;
    }

    @Get("pkiconfig")
    public QueryPKI_Config(
        @Common resourceReference: ResourceReference,
    )
    {
        return this.keyVaultManager.QueryPKI_Config(resourceReference);
    }

    @Post("pkiconfig")
    public async UpdatePKI_Config(
        @Common resourceReference: ResourceReference,
        @Body caConfig: CA_Config
    )
    {
        await this.keyVaultManager.UpdatePKI_Config(resourceReference, caConfig);
    }

    @Post("secrets")
    public async CreateSecret(
        @Common resourceReference: ResourceReference,
        @Body secret: SecretDTO
    )
    {
        await this.keyVaultManager.CreateSecret(resourceReference, secret.name, secret.secretValue);
    }

    @Delete("secrets/{name}")
    public async DeleteSecret(
        @Common resourceReference: ResourceReference,
        @Path name: string
    )
    {
        await this.keyVaultManager.DeleteSecret(resourceReference, name);
    }

    @Get("secrets/{name}")
    public async QuerySecret(
        @Common resourceReference: ResourceReference,
        @Path name: string
    )
    {
        const value = await this.keyVaultManager.ReadSecret(resourceReference, name);
        const res: SecretDTO = {
            name,
            secretValue: value
        }
        return res;
    }

    @Get("secrets")
    public async QuerySecrets(
        @Common resourceReference: ResourceReference,
    )
    {
        const names = await this.keyVaultManager.QuerySecretNames(resourceReference);
        return names.map<SecretListDTO>(x => ({
            name: x
        }));
    }
}