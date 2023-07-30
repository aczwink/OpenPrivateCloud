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

export interface API_GatewayProperties extends BaseResourceProperties
{
    type: "api-gateway";

    /**
     * @title Virtual network
     * @format instance-same-host[network-services/virtual-network]
     */
    vnetResourceExternalId: string;
}

export interface JdownloaderProperties extends BaseResourceProperties
{
    type: "jdownloader";
}

export interface LetsEncryptProperties extends BaseResourceProperties
{
    type: "letsencrypt-cert";
    domainName: string;
}

export interface NextcloudProperties extends BaseResourceProperties
{
    type: "nextcloud";

     /**
     * @title Certificate
     * @format instance-same-host[web-services/letsencrypt-cert]
     */
    certResourceExternalId: string;
}

export interface NodeAppServiceProperties extends BaseResourceProperties
{
    type: "node-app-service";
}

export interface StaticWebsiteProperties extends BaseResourceProperties
{
    type: "static-website";
    
    port: number;
}

export type WebServicesResourceProperties = API_GatewayProperties
    | JdownloaderProperties
    | LetsEncryptProperties
    | NextcloudProperties
    | NodeAppServiceProperties
    | StaticWebsiteProperties;