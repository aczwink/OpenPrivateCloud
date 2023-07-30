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
import { CollectionViewModel, ComponentViewModel, MultiPageViewModel, ObjectViewModel } from "../../UI/ViewModel";
import { BuildCommonResourceActions, BuildResourceGeneralPageGroupEntry } from "../shared/resourcegeneral";
import { CA_Config, CertificateDTO, KeyVaultCertificate } from "../../../dist/api";
import { PageNotFoundComponent } from "../../PageNotFoundComponent";

type ResourceAndGroupId = { resourceGroupName: string; resourceName: string };

function BuildResourceId(resourceGroupName: string, resourceName: string)
{
    return "/" + resourceGroupName + "/" + resourceProviders.securityServices.name + "/" + resourceProviders.securityServices.keyVaultResourceTypeName.name + "/" + resourceName;
}

const certViewModel: ComponentViewModel = {
    component: PageNotFoundComponent,
    type: "component"
};

const certsViewModel: CollectionViewModel<KeyVaultCertificate, ResourceAndGroupId, CertificateDTO> = {
    type: "collection",
    actions: [
        {
            type: "create",
            createResource: (service, ids, cert) => service.resourceProviders._any_.securityservices.keyvault._any_.certificates.post(ids.resourceGroupName, ids.resourceName, cert),
            schemaName: "CertificateDTO"
        }
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
