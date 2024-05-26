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

import { BaseResourceProperties } from "../ResourceProvider";

export interface API_GatewayProperties extends BaseResourceProperties
{
    type: "api-gateway";

    /**
     * @title Virtual network
     * @format resource-same-host[network-services/virtual-network]
     */
    vnetResourceExternalId: string;
}

export interface JdownloaderProperties extends BaseResourceProperties
{
    type: "jdownloader";

    /**
     * @title Virtual network
     * @format resource-same-host[network-services/virtual-network]
     */
    vnetResourceExternalId: string;
}

export interface LetsEncryptProperties extends BaseResourceProperties
{
    type: "letsencrypt-cert";

    domainName: string;

    /**
     * The target key vault where the certificate will be imported to.
     * @title Key-Vault
     * @format resource[security-services/key-vault]
     */
    keyVaultExternalId: string;

    /**
     * LetsEncrypt will verify certificates by issuing requests on port 80 to the domain. Specify a different port in case you use port mapping.
     * @default 80
     */
    sourcePort: number;

    /**
     * A CIDR-range of the virtual network that is deployed when interacting with LetsEncrypt. A /30 net is sufficient. Smaller is not possible.
     * @default 192.168.255.252/30
     */
    vNetAddressSpace: string;
}

export interface NextcloudProperties extends BaseResourceProperties
{
    type: "nextcloud";

    /**
     * @format key-vault-reference[certificate]
     * @title Certificate
     */
    keyVaultCertificateReference: string;

    trustedDomain: string;

    /**
     * @title Virtual network
     * @format resource-same-host[network-services/virtual-network]
     */
    vnetResourceExternalId: string;
}

export interface NodeAppServiceProperties extends BaseResourceProperties
{
    type: "node-app-service";
}

export interface StaticWebsiteProperties extends BaseResourceProperties
{
    type: "static-website";

    /**
     * @title Virtual network
     * @format resource-same-host[network-services/virtual-network]
     */
    vNetExternalId: string;
    
    port: number;
}

export type WebServicesResourceProperties = API_GatewayProperties
    | JdownloaderProperties
    | LetsEncryptProperties
    | NextcloudProperties
    | NodeAppServiceProperties
    | StaticWebsiteProperties;