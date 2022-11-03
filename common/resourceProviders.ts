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

import { c_backupServicesResourceProviderName, c_backupVaultResourceTypeName, c_computeServicesResourceProviderName, c_virtualMachineResourceTypeName, c_fileServicesResourceProviderName, c_fileStorageResourceTypeName, c_networkServicesResourceProviderName, c_openVPNGatewayResourceTypeName } from "./constants";

export const resourceProviders =
{
    backupServices: {
        name: c_backupServicesResourceProviderName,
        backupVaultResourceType: {
            name: c_backupVaultResourceTypeName
        }
    },

    computeServices: {
        name: c_computeServicesResourceProviderName,
        virtualMachineResourceType: {
            name: c_virtualMachineResourceTypeName
        }
    },

    fileServices: {
        name: c_fileServicesResourceProviderName,
        fileStorageResourceType: {
            name: c_fileStorageResourceTypeName
        }
    },

    networkServices: {
        name: c_networkServicesResourceProviderName,
        openVPNGatewayResourceType: {
            name: c_openVPNGatewayResourceTypeName
        }
    }
}