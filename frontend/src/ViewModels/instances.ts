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


import { RoutingViewModel } from "../UI/ViewModel";
import { InstancesListComponent } from "../Views/instances/InstancesListComponent";
import { resourceProviders } from "openprivatecloud-common/resourceProviders";
import { backupVaultViewModel } from "./backup-services/backup-vault";
import { virtualMachineViewModel } from "./compute-services/virtual-machine";
import { mariadbViewModel } from "./database-services/mariadb";
import { fileStorageViewModel } from "./file-services/file-storage";
import { openVPNGatewayViewModel } from "./network-services.ts/openvpn-gateway";
import { nextcloudViewModel } from "./web-services/nextcloud";
import { AddInstanceComponent } from "../Views/instances/AddInstanceComponent";
import { jdownloaderViewModel } from "./web-services/jdownloader";
import { avTranscoderViewModel } from "./multimedia-services/av-transcoder";

const root: RoutingViewModel = {
    type: "routing",
    entries: [
        {
            key: "instances",
            viewModel: {
                type: "component",
                component: InstancesListComponent
            },
        },
        {
            key: "instances/add",
            viewModel: {
                type: "component",
                component: AddInstanceComponent,
            }
        },
        {
            key: `instances/${resourceProviders.backupServices.name}/${resourceProviders.backupServices.backupVaultResourceType.name}/:instanceName`,
            viewModel: backupVaultViewModel
        },
        {
            key: `instances/${resourceProviders.computeServices.name}/${resourceProviders.computeServices.virtualMachineResourceType.name}/:instanceName`,
            viewModel: virtualMachineViewModel
        },
        {
            key: `instances/${resourceProviders.databaseServices.name}/${resourceProviders.databaseServices.mariadbResourceType.name}/:instanceName`,
            viewModel: mariadbViewModel
        },
        {
            key: `instances/${resourceProviders.fileServices.name}/${resourceProviders.fileServices.fileStorageResourceType.name}/:instanceName`,
            viewModel: fileStorageViewModel
        },
        {
            key: `instances/${resourceProviders.multimediaServices.name}/${resourceProviders.multimediaServices.avTranscoderResourceType.name}/:instanceName`,
            viewModel: avTranscoderViewModel,
        },
        {
            key: `instances/${resourceProviders.networkServices.name}/${resourceProviders.networkServices.openVPNGatewayResourceType.name}/:instanceName`,
            viewModel: openVPNGatewayViewModel,
        },
        {
            key: `instances/${resourceProviders.webServices.name}/${resourceProviders.webServices.jdownloaderResourceType.name}/:instanceName`,
            viewModel: jdownloaderViewModel,
        },
        {
            key: `instances/${resourceProviders.webServices.name}/${resourceProviders.webServices.nextcloudResourceType.name}/:instanceName`,
            viewModel: nextcloudViewModel,
        }
    ]
}

export default root;