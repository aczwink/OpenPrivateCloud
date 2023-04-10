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

export interface CertKeyFiles
{
    caCertPath: string;
    certPath: string;
    keyPath: string;
    dhPath: string;
    crlPath: string;
}

export interface OpenVPNServerConfig
{
    port: number;
    protocol: "tcp" | "udp";
    
    /**
     * CIDR-range
     */
    virtualServerAddressRange: string;

    cipher: "AES-256-CBC";
    /**
     * 0 means no output except fatal errors, 1-4 normal usage range (3 recommended), 5 output info for each packet, 6-11 debug info
     * @title Logging verbosity
     * @minimum 0
     * @maximum 11
     * @default 1
     */
    verbosity: number;
    authenticationAlgorithm: "SHA256";
}