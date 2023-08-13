/**
 * OpenPrivateCloud
 * Copyright (C) 2023 Amir Czwink (amir130@hotmail.de)
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
import { CollectionViewModel, MultiPageViewModel, ObjectViewModel } from "../../UI/ViewModel";
import { BuildCommonResourceActions, BuildResourceGeneralPageGroupEntry } from "../shared/resourcegeneral";
import { CA_Config, CertificateDTO, KeyCreationDTO, KeyDTO, KeyVaultCertificate, KeyVaultCertificateInfo, SecretDTO, SecretListDTO } from "../../../dist/api";

type ResourceAndGroupId = { resourceGroupName: string; resourceName: string };

function BuildResourceId(resourceGroupName: string, resourceName: string)
{
    return "/" + resourceGroupName + "/" + resourceProviders.securityServices.name + "/" + resourceProviders.securityServices.keyVaultResourceTypeName.name + "/" + resourceName;
}

const keyViewModel: ObjectViewModel<KeyDTO, ResourceAndGroupId & { keyName: string }> = {
    type: "object",
    actions: [],
    formTitle: (ids, _) => ids.keyName,
    requestObject: async (_, ids) => ({
        data: { name: ids.keyName },
        rawBody: null,
        statusCode: 200
    }),
    schemaName: "KeyDTO"
};

const keysViewModel: CollectionViewModel<KeyDTO, ResourceAndGroupId, KeyCreationDTO> = {
    type: "collection",
    actions: [
        {
            type: "create",
            createResource: (service, ids, key) => service.resourceProviders._any_.securityservices.keyvault._any_.keys.post(ids.resourceGroupName, ids.resourceName, key),
            schemaName: "KeyCreationDTO"
        }
    ],
    child: keyViewModel,
    displayName: "Keys",
    extractId: x => x.name,
    requestObjects: (service, ids) => service.resourceProviders._any_.securityservices.keyvault._any_.keys.get(ids.resourceGroupName, ids.resourceName),
    idKey: "keyName",
    schemaName: "KeyDTO"
};

const secretViewModel: ObjectViewModel<SecretDTO, ResourceAndGroupId & { secretName: string }> = {
    type: "object",
    actions: [
        {
            type: "delete",
            deleteResource: (service, ids) => service.resourceProviders._any_.securityservices.keyvault._any_.secrets._any_.delete(ids.resourceGroupName, ids.resourceName, ids.secretName)
        }
    ],
    formTitle: (ids, _) => ids.secretName,
    requestObject: (service, ids) => service.resourceProviders._any_.securityservices.keyvault._any_.secrets._any_.get(ids.resourceGroupName, ids.resourceName, ids.secretName),
    schemaName: "SecretDTO"
};

const secretsViewModel: CollectionViewModel<SecretListDTO, ResourceAndGroupId, SecretDTO> = {
    type: "collection",
    actions: [
        {
            type: "create",
            createResource: (service, ids, secret) => service.resourceProviders._any_.securityservices.keyvault._any_.secrets.post(ids.resourceGroupName, ids.resourceName, secret),
            schemaName: "SecretDTO"
        }
    ],
    child: secretViewModel,
    displayName: "Secrets",
    extractId: x => x.name,
    requestObjects: (service, ids) => service.resourceProviders._any_.securityservices.keyvault._any_.secrets.get(ids.resourceGroupName, ids.resourceName),
    idKey: "secretName",
    schemaName: "SecretListDTO"
};

const certViewModel: ObjectViewModel<KeyVaultCertificateInfo, ResourceAndGroupId & { certName: string }> = {
    type: "object",
    actions: [
        {
            type: "delete",
            deleteResource: (service, ids) => service.resourceProviders._any_.securityservices.keyvault._any_.certificates._any_.delete(ids.resourceGroupName, ids.resourceName, ids.certName),
        }
    ],
    formTitle: (ids, _) => ids.certName,
    requestObject: (service, ids) => service.resourceProviders._any_.securityservices.keyvault._any_.certificates._any_.get(ids.resourceGroupName, ids.resourceName, ids.certName),
    schemaName: "KeyVaultCertificateInfo"
};

const certsViewModel: CollectionViewModel<KeyVaultCertificate, ResourceAndGroupId, CertificateDTO> = {
    type: "collection",
    actions: [
        {
            type: "create",
            createResource: (service, ids, cert) => service.resourceProviders._any_.securityservices.keyvault._any_.certificates.post(ids.resourceGroupName, ids.resourceName, cert),
            schemaName: "CertificateDTO"
        },
    ],
    child: certViewModel,
    displayName: "Certificates",
    extractId: x => x.name,
    requestObjects: (service, ids) => service.resourceProviders._any_.securityservices.keyvault._any_.certificates.get(ids.resourceGroupName, ids.resourceName),
    idKey: "certName",
    schemaName: "KeyVaultCertificate"
};

const caViewModel: ObjectViewModel<CA_Config, ResourceAndGroupId> = {
    type: "object",
    actions: [
        {
            type: "edit",
            propertiesSchemaName: "CA_Config",
            requestObject: (service, ids) => service.resourceProviders._any_.securityservices.keyvault._any_.pkiconfig.get(ids.resourceGroupName, ids.resourceName),
            updateResource: (service, ids, config) => service.resourceProviders._any_.securityservices.keyvault._any_.pkiconfig.post(ids.resourceGroupName, ids.resourceName, config),
        }
    ],
    formTitle: _ => "Certificate Authority",
    requestObject: (service, ids) => service.resourceProviders._any_.securityservices.keyvault._any_.pkiconfig.get(ids.resourceGroupName, ids.resourceName),
    schemaName: "CA_Config",
};

export const keyVaultViewModel: MultiPageViewModel<ResourceAndGroupId> = {
    actions: [
        ...BuildCommonResourceActions(BuildResourceId)
    ],
    entries: [
        BuildResourceGeneralPageGroupEntry(BuildResourceId),
        {
            displayName: "",
            entries: [
                {
                    child: keysViewModel,
                    displayName: "Keys",
                    key: "keys",
                },
                {
                    child: secretsViewModel,
                    displayName: "Secrets",
                    key: "secrets",
                }
            ]
        },
        {
            displayName: "PKI",
            entries: [
                {
                    child: certsViewModel,
                    displayName: "Certificates",
                    key: "certs"
                },
                {
                    child: caViewModel,
                    displayName: "CA",
                    key: "ca",
                }
            ]
        }
    ],
    formTitle: ids => ids.resourceName,
    type: "multiPage"
};
