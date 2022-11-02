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

import { resourceProviders } from "openprivatecloud-common/resourceProviders";
import { RoutingViewModel } from "../UI/ViewModel";
import { backupVaultViewModel } from "./backup-services/backup-vault";
import { virtualMachineViewModel } from "./compute-services/virtual-machine";
import { fileStorageViewModel } from "./file-services/file-storage";

 
export const instanceTypesRouting: RoutingViewModel = {
    type: "routing",
    entries: [
        {
            key: `${resourceProviders.backupServices.name}/${resourceProviders.backupServices.backupVaultResourceType.name}/:instanceName`,
            viewModel: backupVaultViewModel
        },
        {
            key: `${resourceProviders.computeServices.name}/${resourceProviders.computeServices.virtualMachineResourceType.name}/:instanceName`,
            viewModel: virtualMachineViewModel
        },
        {
            key: `${resourceProviders.fileServices.name}/${resourceProviders.fileServices.fileStorageResourceType.name}/:instanceName`,
            viewModel: fileStorageViewModel
        }
    ]
};