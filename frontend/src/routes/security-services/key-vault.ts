/**
 * OpenPrivateCloud
 * Copyright (C) 2023-2024 Amir Czwink (amir130@hotmail.de)
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
import { resourceProviders } from "openprivatecloud-common";
import { CA_Config, CertificateDTO, KeyCreationDTO, KeyDTO, KeyVaultCertificate, KeyVaultCertificateInfo, SecretDTO, SecretListDTO } from "../../../dist/api";
import { APIResponseHandler, RouteSetup } from "acfrontendex";
import { BuildCommonResourceActions, BuildResourceGeneralPageGroupEntry } from "../resources-shared/resource-general";
import { FileDownloadService, Use } from "acfrontend";
import { APIService } from "../../services/APIService";
import { APISchemaOf, OpenAPISchema } from "../../api-info";

type ResourceAndGroupId = { resourceGroupName: string; resourceName: string };

function BuildResourceId(resourceGroupName: string, resourceName: string)
{
    return "/" + resourceGroupName + "/" + resourceProviders.securityServices.name + "/" + resourceProviders.securityServices.keyVaultResourceTypeName.name + "/" + resourceName;
}

const createKeyRoute: RouteSetup<ResourceAndGroupId, KeyCreationDTO> = {
    content: {
        type: "create",
        call: (ids, key) => Use(APIService).resourceProviders._any_.securityservices.keyvault._any_.keys.post(ids.resourceGroupName, ids.resourceName, key),
        schema: OpenAPISchema("KeyCreationDTO"),
    },
    displayText: "Create key",
    icon: "plus",
    routingKey: "create"
};

const keyViewModel: RouteSetup<ResourceAndGroupId & { keyName: string }, KeyDTO> = {
    content: {
        type: "object",
        actions: [
            {
                type: "form",

                icon: "key",
                schema: {
                    type: "string",
                    format: "binary"
                },
                submit: async (ids, data) => {
                    const response = await Use(APIService).resourceProviders._any_.securityservices.keyvault._any_.keys._any_.decrypt.post(ids.resourceGroupName, ids.resourceName, ids.keyName, { data })
                    const result = await Use(APIResponseHandler).ExtractDataFromResponseOrShowErrorMessageOnError(response);
                    if(result.ok)
                        Use(FileDownloadService).DownloadBlobAsFile(result.value, "decrypted");
                    return response;
                },
                title: "Decrypt",
            }
        ],
        formTitle: (ids, _) => ids.keyName,
        requestObject: ids => Use(APIService).resourceProviders._any_.securityservices.keyvault._any_.keys._any_.get(ids.resourceGroupName, ids.resourceName, ids.keyName),
        schema: APISchemaOf(x => x.KeyDTO)
    },
    displayText: "Key",
    icon: "key",
    routingKey: "{keyName}",
};

const keysViewModel: RouteSetup<ResourceAndGroupId, KeyDTO> = {
    content: {
        type: "collection",
        actions: [
            createKeyRoute,
        ],
        child: keyViewModel,
        id: "name",
        requestObjects: ids => Use(APIService).resourceProviders._any_.securityservices.keyvault._any_.keys.get(ids.resourceGroupName, ids.resourceName),
        schema: APISchemaOf(x => x.KeyDTO)
    },
    displayText: "Keys",
    icon: "key",
    routingKey: "keys",
};

const createSecretRoute: RouteSetup<ResourceAndGroupId, SecretDTO> = {
    content: {
        type: "create",
        call: (ids, secret) => Use(APIService).resourceProviders._any_.securityservices.keyvault._any_.secrets.post(ids.resourceGroupName, ids.resourceName, secret),
        schema: OpenAPISchema("SecretDTO"),
    },
    displayText: "Create secret",
    icon: "plus",
    routingKey: "create"
};

const secretViewModel: RouteSetup<ResourceAndGroupId & { secretName: string }, SecretDTO> = {
    content: {
        type: "object",
        actions: [
            {
                type: "delete",
                deleteResource: ids => Use(APIService).resourceProviders._any_.securityservices.keyvault._any_.secrets._any_.delete(ids.resourceGroupName, ids.resourceName, ids.secretName)
            }
        ],
        formTitle: (ids, _) => ids.secretName,
        requestObject: ids => Use(APIService).resourceProviders._any_.securityservices.keyvault._any_.secrets._any_.get(ids.resourceGroupName, ids.resourceName, ids.secretName),
        schema: OpenAPISchema("SecretDTO")
    },
    displayText: "Secret",
    icon: "incognito",
    routingKey: "{secretName}",
};

const secretsViewModel: RouteSetup<ResourceAndGroupId, SecretListDTO> = {
    content: {
        type: "collection",
        actions: [
            createSecretRoute
        ],
        child: secretViewModel,
        id: "name",
        requestObjects: ids => Use(APIService).resourceProviders._any_.securityservices.keyvault._any_.secrets.get(ids.resourceGroupName, ids.resourceName),
        schema: OpenAPISchema("SecretListDTO")
    },
    displayText: "Secrets",
    icon: "incognito",
    routingKey: "secrets",
};

const createCertRoute: RouteSetup<ResourceAndGroupId, CertificateDTO> = {
    content: {
        type: "create",
        call: (ids, cert) => Use(APIService).resourceProviders._any_.securityservices.keyvault._any_.certificates.post(ids.resourceGroupName, ids.resourceName, cert),
        schema: OpenAPISchema("CertificateDTO"),
    },
    displayText: "Create certificate",
    icon: "plus",
    routingKey: "create"
};

const certViewModel: RouteSetup<ResourceAndGroupId & { certName: string }, KeyVaultCertificateInfo> = {
    content: {
        type: "object",
        actions: [
            {
                type: "delete",
                deleteResource: ids => Use(APIService).resourceProviders._any_.securityservices.keyvault._any_.certificates._any_.delete(ids.resourceGroupName, ids.resourceName, ids.certName),
            }
        ],
        formTitle: (ids, _) => ids.certName,
        requestObject: ids => Use(APIService).resourceProviders._any_.securityservices.keyvault._any_.certificates._any_.get(ids.resourceGroupName, ids.resourceName, ids.certName),
        schema: OpenAPISchema("KeyVaultCertificateInfo")
    },
    displayText: "Certificate",
    icon: "filetype-key",
    routingKey: "{certName}",
};

const certsViewModel: RouteSetup<ResourceAndGroupId, KeyVaultCertificate> = {
    content: {
        type: "collection",
        actions: [
            createCertRoute
        ],
        child: certViewModel,
        id: "name",
        requestObjects: ids => Use(APIService).resourceProviders._any_.securityservices.keyvault._any_.certificates.get(ids.resourceGroupName, ids.resourceName),
        schema: OpenAPISchema("KeyVaultCertificate")
    },
    displayText: "Certificates",
    icon: "filetype-key",
    routingKey: "certs",
};

const caViewModel: RouteSetup<ResourceAndGroupId, CA_Config> = {
    content: {
        type: "object",
        actions: [
            {
                type: "edit",
                requestObject: ids => Use(APIService).resourceProviders._any_.securityservices.keyvault._any_.pkiconfig.get(ids.resourceGroupName, ids.resourceName),
                schema: OpenAPISchema("CA_Config"),
                updateResource: (ids, config) => Use(APIService).resourceProviders._any_.securityservices.keyvault._any_.pkiconfig.post(ids.resourceGroupName, ids.resourceName, config),
            }
        ],
        formTitle: _ => "Certificate Authority",
        requestObject: (ids) => Use(APIService).resourceProviders._any_.securityservices.keyvault._any_.pkiconfig.get(ids.resourceGroupName, ids.resourceName),
        schema: OpenAPISchema("CA_Config")
    },
    displayText: "CA",
    icon: "building",
    routingKey: "ca",
};

export const keyVaultViewModel: RouteSetup<ResourceAndGroupId> = {
    content: {
        type: "multiPage",
        actions: [
            ...BuildCommonResourceActions(BuildResourceId)
        ],
        entries: [
            {
                displayName: "",
                entries: [
                    keysViewModel,
                    secretsViewModel
                ]
            },
            {
                displayName: "PKI",
                entries: [
                    certsViewModel,
                    caViewModel
                ]
            },
            BuildResourceGeneralPageGroupEntry(BuildResourceId),
        ],
        formTitle: ids => ids.resourceName,
    },
    displayText: "Key Vault",
    icon: "key",
    routingKey: `${resourceProviders.securityServices.name}/${resourceProviders.securityServices.keyVaultResourceTypeName.name}/{resourceName}`,
};
