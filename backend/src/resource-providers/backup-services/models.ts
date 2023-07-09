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

import { TimeSchedule } from "../../common/TimeSchedule";

export interface BackupVaultFileStorageConfig
{
    /**
     * @title File storage
     * @format instance-same-host[file-services/file-storage]
     */
    fullInstanceName: string;

    /**
     * @title Create snapshot right before saving snapshots in this vault
     */
    createSnapshotBeforeBackup: boolean;
}

export interface BackupVaultDatabaseConfig
{
    /**
     * @title MariaDB Instance
     * @format instance-same-host[database-services/mariadb]
     */
     fullInstanceName: string;
     databaseName: string;
}

export interface BackupVaultSourcesConfig
{
    fileStorages: BackupVaultFileStorageConfig[];
    databases: BackupVaultDatabaseConfig[];
}

interface BackupVaultStorageDeviceTargetConfig
{
    type: "storage-device";
    storageDeviceUUID: string;
}

export interface BackupVaultWebDAVTargetConfig
{
    type: "webdav";
    serverUrl: string;
    userName: string;
    /**
     * @format secret
     */
    password: string;
    /**
     * Leave blank for no encryption
     * @format multi-line
     */
     encryptionPassphrase: string;
}

export type BackupVaultTargetConfig = BackupVaultStorageDeviceTargetConfig | BackupVaultWebDAVTargetConfig;

interface BackupVaultManualTrigger
{
    type: "manual";
}
interface BackupVaultAutomaticTrigger
{
    type: "automatic";
    schedule: TimeSchedule;
}

export type BackupVaultTrigger = BackupVaultManualTrigger | BackupVaultAutomaticTrigger;

export interface BackupVaultRetentionConfig
{
    numberOfDays: number;
}