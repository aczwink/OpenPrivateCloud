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

import { c_dnsServerResourceTypeName, c_networkServicesResourceProviderName } from "openprivatecloud-common/dist/constants";
import { ResourceAPIControllerBase } from "../ResourceAPIControllerBase";
import { APIController, Body, Common, Delete, Get, NotFound, Path, Post, Put } from "acts-util-apilib";
import { ResourcesManager } from "../../services/ResourcesManager";
import { ResourceReference } from "../../common/ResourceReference";
import { DNS_Record, DNS_ServerManager } from "./DNS_ServerManager";

interface DNS_ZoneDTO
{
    name: string;
}

@APIController(`resourceProviders/{resourceGroupName}/${c_networkServicesResourceProviderName}/${c_dnsServerResourceTypeName}/{resourceName}`)
class _api_ extends ResourceAPIControllerBase
{
    constructor(resourcesManager: ResourcesManager, private dnsServerManager: DNS_ServerManager)
    {
        super(resourcesManager, c_networkServicesResourceProviderName, c_dnsServerResourceTypeName);
    }

    @Common()
    public async ExtractCommonAPIData(
        @Path resourceGroupName: string,
        @Path resourceName: string
    )
    {
        return this.FetchResourceReference(resourceGroupName, resourceName);
    }

    @Post("zones")
    public async AddZone(
        @Common resourceReference: ResourceReference,
        @Body data: DNS_ZoneDTO,
    )
    {
        return await this.dnsServerManager.AddZone(resourceReference, data.name);
    }

    @Get("zones")
    public async QueryZones(
        @Common resourceReference: ResourceReference,
    )
    {
        const zones = await this.dnsServerManager.QueryZones(resourceReference);
        return zones.map(x => {
            const res: DNS_ZoneDTO = { name: x.name };
            return res;
        });
    }

    @Delete("zones/{zoneName}")
    public async DeleteZone(
        @Common resourceReference: ResourceReference,
        @Path zoneName: string
    )
    {
        return await this.dnsServerManager.DeleteZone(resourceReference, zoneName);
    }

    @Post("zones/{zoneName}/records")
    public async AddZoneRecord(
        @Common resourceReference: ResourceReference,
        @Path zoneName: string,
        @Body record: DNS_Record
    )
    {
        const success = await this.dnsServerManager.AddZoneRecord(resourceReference, zoneName, record);
        if(!success)
            return NotFound("zone not found");
    }

    @Delete("zones/{zoneName}/records")
    public async DeleteZoneRecord(
        @Common resourceReference: ResourceReference,
        @Path zoneName: string,
        @Body record: DNS_Record
    )
    {
        const success = await this.dnsServerManager.DeleteZoneRecord(resourceReference, zoneName, record);
        if(!success)
            return NotFound("zone or record not found");
    }

    @Get("zones/{zoneName}/records")
    public async QueryZoneRecords(
        @Common resourceReference: ResourceReference,
        @Path zoneName: string
    )
    {
        const zone = await this.dnsServerManager.QueryZone(resourceReference, zoneName);
        if(zone === undefined)
            return NotFound("zone not found");
        return zone.records;
    }

    @Put("zones/{zoneName}/records/{recordIndex}")
    public async EditZoneRecord(
        @Common resourceReference: ResourceReference,
        @Path zoneName: string,
        @Path recordIndex: number,
        @Body record: DNS_Record
    )
    {
        const success = await this.dnsServerManager.EditZoneRecord(resourceReference, zoneName, recordIndex, record);
        if(!success)
            return NotFound("zone or record not found");
    }
}