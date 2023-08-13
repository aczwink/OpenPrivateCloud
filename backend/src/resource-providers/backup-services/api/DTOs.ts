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

import { BackupVaultControllerDatabaseConfig, BackupVaultDatabaseConfig, BackupVaultFileStorageConfig, BackupVaultStorageDeviceTargetConfig } from "../models";

interface BackupVaultKeyVaultSourceDTO
{
    /**
     * @title Key Vault
     * @format resource-same-host[security-services/key-vault]
     */
    id: string;
}

export interface BackupVaultSourcesDTO
{
    databases: BackupVaultDatabaseConfig[];
    controllerDB: BackupVaultControllerDatabaseConfig;
    fileStorages: BackupVaultFileStorageConfig[];
    keyVaults: BackupVaultKeyVaultSourceDTO[];
}

export type BackupVaultAnySourceConfigDTO = BackupVaultFileStorageConfig | BackupVaultDatabaseConfig | BackupVaultKeyVaultSourceDTO;


interface WebDAVTargetConfigDTO
{
    type: "webdav";
    serverURL: string;
    /**
     * @default /
     */
    rootPath: string;
    userName: string;
    /**
     * @format key-vault-reference[secret]
     * @title Password
     */
    passwordKeyVaultSecretReference: string;
    /**
     * Remove this property for no encryption
     * Important: You should never backup to an untrusted source without encryption or sensitive information may be leaked!
     * @format key-vault-reference[key]
     * @title Encryption key
     */
     encryptionKeyKeyVaultReference?: string;
}

export type BackupVaultTargetConfigDTO = BackupVaultStorageDeviceTargetConfig | WebDAVTargetConfigDTO;