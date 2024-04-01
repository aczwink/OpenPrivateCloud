/**
 * OpenPrivateCloud
 * Copyright (C) 2019-2024 Amir Czwink (amir130@hotmail.de)
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
import { RoutingViewModel } from "../UI/ViewModel";
import { resourceProviders } from "openprivatecloud-common/resourceProviders";
import { backupVaultViewModel } from "./backup-services/backup-vault";
import { virtualMachineViewModel } from "./compute-services/virtual-machine";
import { mariadbViewModel } from "./database-services/mariadb";
import { fileStorageViewModel } from "./file-services/file-storage";
import { openVPNGatewayViewModel } from "./network-services.ts/openvpn-gateway";
import { nextcloudViewModel } from "./web-services/nextcloud";
import { jdownloaderViewModel } from "./web-services/jdownloader";
import { avTranscoderViewModel } from "./multimedia-services/av-transcoder";
import { staticWebsiteViewModel } from "./web-services/staticWebsite";
import { nodeAppServiceViewodel } from "./web-services/nodeAppService";
import { dockerContainerViewModel } from "./compute-services/docker-container";
import { letsEncryptViewModel } from "./web-services/letsencrypt-cert";
import { dnsServerViewModel } from "./network-services.ts/dns-server";
import { vnetViewModel } from "./network-services.ts/virtual-network";
import { keyVaultViewModel } from "./security-services/key-vault";
import { apiGatewayViewModel } from "./web-services/api-gateway";
import { addcViewModel } from "./integration-services/managed-ad";
import { objectStorageViewModel } from "./file-services/object-storage";
import { ResourceListComponent } from "../Views/resources/ResourceListComponent";

export const resourcesRoutes: RoutingViewModel = {
    type: "routing",
    entries: [
        {
            key: `${resourceProviders.backupServices.name}/${resourceProviders.backupServices.backupVaultResourceType.name}/:resourceName`,
            viewModel: backupVaultViewModel
        },
        {
            key: `${resourceProviders.computeServices.name}/${resourceProviders.computeServices.dockerContainerResourceType.name}/:resourceName`,
            viewModel: dockerContainerViewModel
        },
        {
            key: `${resourceProviders.computeServices.name}/${resourceProviders.computeServices.virtualMachineResourceType.name}/:resourceName`,
            viewModel: virtualMachineViewModel
        },
        {
            key: `${resourceProviders.databaseServices.name}/${resourceProviders.databaseServices.mariadbResourceType.name}/:resourceName`,
            viewModel: mariadbViewModel
        },
        {
            key: `${resourceProviders.fileServices.name}/${resourceProviders.fileServices.fileStorageResourceType.name}/:resourceName`,
            viewModel: fileStorageViewModel
        },
        {
            key: `${resourceProviders.fileServices.name}/${resourceProviders.fileServices.objectStorageResourceType.name}/:resourceName`,
            viewModel: objectStorageViewModel
        },
        {
            key: `${resourceProviders.integrationServices.name}/${resourceProviders.integrationServices.managedActiveDirectoryResourceType.name}/:resourceName`,
            viewModel: addcViewModel,
        },
        {
            key: `${resourceProviders.multimediaServices.name}/${resourceProviders.multimediaServices.avTranscoderResourceType.name}/:resourceName`,
            viewModel: avTranscoderViewModel,
        },
        {
            key: `${resourceProviders.networkServices.name}/${resourceProviders.networkServices.dnsServerResourceType.name}/:resourceName`,
            viewModel: dnsServerViewModel,
        },
        {
            key: `${resourceProviders.networkServices.name}/${resourceProviders.networkServices.openVPNGatewayResourceType.name}/:resourceName`,
            viewModel: openVPNGatewayViewModel,
        },
        {
            key: `${resourceProviders.networkServices.name}/${resourceProviders.networkServices.virtualNetworkResourceType.name}/:resourceName`,
            viewModel: vnetViewModel,
        },
        {
            key: `${resourceProviders.securityServices.name}/${resourceProviders.securityServices.keyVaultResourceTypeName.name}/:resourceName`,
            viewModel: keyVaultViewModel,
        },
        {
            key: `${resourceProviders.webServices.name}/${resourceProviders.webServices.apiGatewayResourceType.name}/:resourceName`,
            viewModel: apiGatewayViewModel,
        },
        {
            key: `${resourceProviders.webServices.name}/${resourceProviders.webServices.jdownloaderResourceType.name}/:resourceName`,
            viewModel: jdownloaderViewModel,
        },
        {
            key: `${resourceProviders.webServices.name}/${resourceProviders.webServices.letsencryptCertResourceType.name}/:resourceName`,
            viewModel: letsEncryptViewModel,
        },
        {
            key: `${resourceProviders.webServices.name}/${resourceProviders.webServices.nextcloudResourceType.name}/:resourceName`,
            viewModel: nextcloudViewModel,
        },
        {
            key: `${resourceProviders.webServices.name}/${resourceProviders.webServices.nodeAppServiceResourceType.name}/:resourceName`,
            viewModel: nodeAppServiceViewodel,
        },
        {
            key: `${resourceProviders.webServices.name}/${resourceProviders.webServices.staticWebsiteResourceType.name}/:resourceName`,
            viewModel: staticWebsiteViewModel,
        }
    ]
}

const root: RoutingViewModel = {
    type: "routing",
    entries: [
        {
            key: "resources",
            viewModel: {
                type: "component",
                component: ResourceListComponent,
            }
        }
    ]
}

export default root;