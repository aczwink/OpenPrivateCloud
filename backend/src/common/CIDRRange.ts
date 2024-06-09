/**
 * OpenPrivateCloud
 * Copyright (C) 2023-2024 Amir Czwink (amir130@hotmail.de)
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

import { IPv4 } from "./IPv4";

export class CIDRRange
{
    constructor(stringRepresentation: string)
    {
        const parts = stringRepresentation.split("/");
        this._netAddress = new IPv4(parts[0]);
        this._length = parseInt(parts[1]);
    }

    //Properties
    public get brodcastAddress()
    {
        const num = this._netAddress.intValue;
        const mask = (1 << (32 - this._length)) - 1;

        return new IPv4(num | mask);
    }

    public get length()
    {
        return this._length;
    }
    
    public get netAddress()
    {
        return this._netAddress;
    }

    public get subnetMask()
    {
        return -1 << (32 - this._length);
    }

    //Public methods
    public GenerateSubnetMask()
    {
        function GenerateSubnetMaskPart(nBits: number)
        {
            if(nBits <= 0)
                return 0;
            nBits = Math.min(nBits, 8);

            let mask = 0;
            for(let i = 0; i < nBits; i++)
            {
                mask <<= 1;
                mask |= 1;
            }
            mask <<= (8 - nBits);
            return mask;
        }

        return new IPv4([this._length, this._length - 8, this._length - 16, this._length - 24].map(GenerateSubnetMaskPart).join("."));
    }

    public Includes(address: IPv4)
    {
        return (address.intValue & this.subnetMask) === this.netAddress.intValue;
    }

    public ToString()
    {
        return this._netAddress.ToString() + "/" + this._length;
    }

    //Functions
    static FromAddressAndSubnetMask(netAddress: string, subnetMask: string)
    {
        function CountBits(value: number)
        {
            let len = 0;
            while(value)
            {
                if(value & 1)
                    len++;
                value >>= 1;
            }
            return len;
        }

        const len = subnetMask.split(".").Values().Map(x => CountBits(parseInt(x))).Sum();

        return new CIDRRange(netAddress + "/" + len);
    }

    static FromIP(ip: IPv4, prefixLength: number)
    {
        const shiftAmount = (32 - prefixLength);
        const shifted = ip.intValue >>> shiftAmount;
        const zeroed = shifted << shiftAmount;

        const netAddress = new IPv4(zeroed);
        return new CIDRRange(netAddress.ToString() + "/" + prefixLength);
    }

    //Private state
    private _netAddress: IPv4;
    private _length: number;
}