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

import "./api/cluster";
import "./api/data";
import "./api/health";
import "./api/hosts";
import "./api/HostStorageDevicesAPIController";
import "./api/HostStoragesAPIController";
import "./api/resourceGroups";
import "./api/resources";
import "./api/processes";
import "./api/ResourceProviderAPIController";
import "./api/RolesAPIController";
import "./api/RoleAssignmentsAPIController";
import "./api/sessions";
import "./api/UserGroupsAPIController";
import "./api/user";
import "./api/UsersAPIController";

import "./resource-providers/backup-services/api/backup-vault";
import "./resource-providers/compute-services/api/docker-container-app-service";
import "./resource-providers/compute-services/VirtualMachineAPIController";
import "./resource-providers/database-services/MariaDB/MariaDBAPIController";
import "./resource-providers/file-services/api/FileStorageAPIController";
import "./resource-providers/file-services/api/object-storage";
import "./resource-providers/integration-services/api/managed-ad";
import "./resource-providers/multimedia-services/AVTranscoderAPIController";
import "./resource-providers/network-services/api/dns-server";
import "./resource-providers/network-services/OpenVPNGatewayAPIController";
import "./resource-providers/network-services/api/vnet";
import "./resource-providers/security-services/apis/key-vault";
import "./resource-providers/web-services/apis/API_Gateway";
import "./resource-providers/web-services/JdownloaderAPIController";
import "./resource-providers/web-services/apis/lets-encrypt";
import "./resource-providers/web-services/apis/node-app-service";
import "./resource-providers/web-services/apis/static-website";

async function LoadAPIControllers()
{
    //import { ModuleLoader } from "acts-util-node";
    /*const apiLoader = new ModuleLoader;
    await apiLoader.LoadDirectory(__dirname + "/api/");
    await apiLoader.LoadDirectory(__dirname + "/resource-providers/");*/
}

LoadAPIControllers();