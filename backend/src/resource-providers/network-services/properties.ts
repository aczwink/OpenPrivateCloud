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
import { OpenVPNGatewayPublicEndpointConfig } from "./OpenVPNGatewayManager";

export interface DNS_ServerProperties extends BaseResourceProperties
{
    type: "dns-server";
}

export interface OpenVPNGatewayProperties extends BaseResourceProperties
{
    type: "openvpn-gateway";
    publicEndpoint: OpenVPNGatewayPublicEndpointConfig;

    /**
     * @title Key-Vault
     * @format resource-same-host[security-services/key-vault]
     */
    keyVaultExternalId: string;
}

export interface VirtualNetworkProperties extends BaseResourceProperties
{
    type: "virtual-network";
    /**
     * CIDR-range
     */
    addressSpace: string;
    enableDHCPv4: boolean;
}

export type NetworkServicesProperties = DNS_ServerProperties | OpenVPNGatewayProperties | VirtualNetworkProperties;