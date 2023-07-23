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

interface ResourceReferenceProperties
{
    id: number;
    resourceGroupName: string;
    resourceProviderName: string;
    resourceType: string;
    name: string;

    hostId: number;
    hostName: string;
    hostStoragePath: string;
}

export interface LightweightResourceReference
{
    readonly id: number;
    readonly hostId: number;
    readonly hostStoragePath: string;
}

export class ResourceReference implements LightweightResourceReference
{
    constructor(private _props: ResourceReferenceProperties)
    {
    }

    //Properties
    public get id()
    {
        return this._props.id;
    }

    public get externalId()
    {
        return "/" + this._props.resourceGroupName + "/" + this._props.resourceProviderName + "/" + this._props.resourceType + "/" + this._props.name;
    }

    public get hostId()
    {
        return this._props.hostId;
    }

    public get hostName()
    {
        return this._props.hostName;
    }

    public get hostStoragePath()
    {
        return this._props.hostStoragePath;
    }

    public get resourceProviderName()
    {
        return this._props.resourceProviderName;
    }

    public get resourceTypeName()
    {
        return this._props.resourceType;
    }
}