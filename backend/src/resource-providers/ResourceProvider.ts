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

export interface BaseResourceProperties
{
    type: string;
    name: string;

    /**
     * @title Hostname
     * @format hostName
     */
    hostName: string;
}

export interface ResourceTypeDefinition
{
    fileSystemType: "btrfs";
    schemaName: string;
}

export interface DeploymentContext
{
    fullInstanceName: string;
    hostId: number;
    storagePath: string
    userId: number;
}

export interface ResourceProvider<PropertiesType extends BaseResourceProperties>
{
    readonly name: string;
    readonly resourceTypeDefinitions: ResourceTypeDefinition[];

    DeleteResource(hostId: number, hostStoragePath: string, fullInstanceName: string): Promise<void>;
    ProvideResource(instanceProperties: PropertiesType, context: DeploymentContext): Promise<void>;
}