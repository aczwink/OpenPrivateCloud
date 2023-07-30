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

import { c_backupServicesResourceProviderName, c_backupVaultResourceTypeName, c_computeServicesResourceProviderName, c_virtualMachineResourceTypeName, c_fileServicesResourceProviderName, c_fileStorageResourceTypeName, c_networkServicesResourceProviderName, c_openVPNGatewayResourceTypeName, c_databaseServicesResourceProviderName, c_mariadbResourceTypeName, c_webServicesResourceProviderName, c_nextcloudResourceTypeName, c_letsencryptCertResourceTypeName, c_nodeAppServiceResourceTypeName, c_staticWebsiteResourceTypeName, c_jdownloaderResourceTypeName, c_multimediaServicesResourceProviderName, c_avTranscoderResourceTypeName, c_dockerContainerResourceTypeName, c_dnsServerResourceTypeName, c_virtualNetworkResourceTypeName, c_securityServicesResourceProviderName, c_keyVaultResourceTypeName, c_apiGatewayResourceTypeName, c_integrationServicesResourceProviderName, c_activeDirectoryDomainControllerResourceTypeName } from "./constants";

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

        dockerContainerResourceType: {
            name: c_dockerContainerResourceTypeName,
        },
        
        virtualMachineResourceType: {
            name: c_virtualMachineResourceTypeName
        }
    },

    databaseServices: {
        name: c_databaseServicesResourceProviderName,
        mariadbResourceType: {
            name: c_mariadbResourceTypeName
        }
    },

    fileServices: {
        name: c_fileServicesResourceProviderName,
        fileStorageResourceType: {
            name: c_fileStorageResourceTypeName
        }
    },

    integrationServices: {
        name: c_integrationServicesResourceProviderName,

        activeDirectoryDomainControllerResourceType: {
            name: c_activeDirectoryDomainControllerResourceTypeName
        }
    },

    multimediaServices: {
        name: c_multimediaServicesResourceProviderName,
        avTranscoderResourceType: {
            name: c_avTranscoderResourceTypeName
        }
    },

    networkServices: {
        name: c_networkServicesResourceProviderName,

        dnsServerResourceType: {
            name: c_dnsServerResourceTypeName
        },

        openVPNGatewayResourceType: {
            name: c_openVPNGatewayResourceTypeName
        },

        virtualNetworkResourceType: {
            name: c_virtualNetworkResourceTypeName
        }
    },

    securityServices: {
        name: c_securityServicesResourceProviderName,

        keyVaultResourceTypeName: {
            name: c_keyVaultResourceTypeName
        }
    },

    webServices: {
        name: c_webServicesResourceProviderName,

        apiGatewayResourceType: {
            name: c_apiGatewayResourceTypeName
        },

        jdownloaderResourceType: {
            name: c_jdownloaderResourceTypeName
        },

        letsencryptCertResourceType: {
            name: c_letsencryptCertResourceTypeName,
        },

        nextcloudResourceType: {
            name: c_nextcloudResourceTypeName
        },

        nodeAppServiceResourceType: {
            name: c_nodeAppServiceResourceTypeName
        },

        staticWebsiteResourceType: {
            name: c_staticWebsiteResourceTypeName
        },
    }
}