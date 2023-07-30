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

interface DNS_A_Record
{
    type: "A";
    name: string;
    target: string;
}

interface DNS_NS_Record
{
    type: "NS";
    name: string;
}

interface DNS_SOA_Record
{
    type: "SOA";
    serialNumber: number;
    /**
     * in seconds
     */
    refreshTime: number;
    /**
     * in seconds
     */
    retryTime: number;
    /**
     * in seconds
     */
    expiryTime: number;
    /**
     * in seconds
     */
    minTTL: number;
}

export type DNS_Record = DNS_A_Record | DNS_NS_Record | DNS_SOA_Record;

export interface DNS_Zone
{
    name: string;
    records: DNS_Record[];
}

export interface DNS_ServerSettings
{
    /**
     * dnsmasq is lightweight and fast but limited in terms of functionality for example CNAME-records to external zones are not supported. bind9 is a fully fledged DNS server.
     */
    backend: "dnsmasq" | "bind9";

    /**
     * IP-Addresses that the server will forward requests to, that are not part of its authorative zones.
     */
    forwarders: string[];
}