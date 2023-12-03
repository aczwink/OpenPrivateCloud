/**
 * OpenPrivateCloud
 * Copyright (C) 2023 Amir Czwink (amir130@hotmail.de)
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

export interface ManagedActiveDirectoryProperties extends BaseResourceProperties
{
    type: "managed-ad";

    domain: string;

    /**
     * Static IP of the primary domain controller. Should be on your hosts network i.e. it is not an IP address of the VNet.
     */
    ipAddress: string;

    /**
     * The VNet serves as the DNS forwarder for the domain controllers.
     * @title Virtual network
     * @format resource-same-host[network-services/virtual-network]
     */
    vnetResourceId: string;
}

export type IntegrationServicesProperties = ManagedActiveDirectoryProperties;