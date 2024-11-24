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

export interface ContainerAppServiceEnvironmentVariableMappingDTO
{
    varName: string;
    value: string;
}

interface ContainerAppServiceSecretDTO
{
    /**
     * @format key-vault-reference[secret]
     * @title Secret
     */
    keyVaultSecretReference: string;

    /**
     * The secret is mounted in the container under /run/secrets/ with the specified name.
     * @title Mounted name
     */
    mountPointSecretName: string;
}

interface ContainerAppServiceVolumeDTO
{
    /**
     * @title File storage
     * @format resource-same-host[file-services/file-storage]
     */
    fileStorageResourceId: string;

    fileStoragePath: string;
    containerPath: string;
    readOnly: boolean;
}

export interface ContainerAppServiceConfigDTO
{
    certificate?: {
        /**
         * @format key-vault-reference[certificate]
         * @title Certificate
         */
        keyVaultCertificateReference: string;

        /**
         * @default /certs/public.crt
         */        
        certificateMountPoint: string;

        /**
         * @default /certs/private.key
         */        
        privateKeyMountPoint: string;
    };

    env: ContainerAppServiceEnvironmentVariableMappingDTO[];

    imageName: string;

    secrets: ContainerAppServiceSecretDTO[];

    /**
     * @title Virtual network
     * @format resource-same-host[network-services/virtual-network]
     */
    vnetResourceId: string;

    volumes: ContainerAppServiceVolumeDTO[];
}