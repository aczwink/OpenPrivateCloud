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

import { BaseResourceProperties } from "../ResourceProvider";

export interface DockerContainerProperties extends BaseResourceProperties
{
    type: "docker-container";
}

export interface VirtualMachineProperties extends BaseResourceProperties
{
    type: "virtual-machine";
    os: "ubuntu-lts-latest" | "ubuntu-server-lts-latest" | "ubuntu-latest" | "ubuntu-server-latest";
    /**
     * @title Size of the OS Disk in GB
     * @default 25
     */
    osDiskSize: number;
}

export type ComputeServicesProperties = DockerContainerProperties | VirtualMachineProperties;