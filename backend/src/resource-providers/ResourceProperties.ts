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

import { BackupVaultProperties } from "./backup-services/BackupVaultProperties";
import { ComputeServicesProperties } from "./compute-services/Properties";
import { MariadbProperties } from "./database-services/MariaDB/MariadbProperties";
import { FileStorageProperties } from "./file-services/FileStorageProperties";
import { AVTranscoderProperties } from "./multimedia-services/AVTranscoderProperties";
import { OpenVPNGatewayProperties } from "./network-services/OpenVPNGatewayProperties";
import { WebServicesResourceProperties } from "./web-services/Properties";

export type AnyResourceProperties = 
    AVTranscoderProperties
    | BackupVaultProperties
    | ComputeServicesProperties
    | FileStorageProperties
    | MariadbProperties
    | OpenVPNGatewayProperties
    | WebServicesResourceProperties;