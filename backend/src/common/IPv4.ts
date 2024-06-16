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

export class IPv4
{
    constructor(input: number | string)
    {
        if(typeof input === "number")
            this._intValue = input;
        else
        {
            const parts = input.split(".");
            this._intValue = (parseInt(parts[0]) << 24)
                | (parseInt(parts[1]) << 16)
                | (parseInt(parts[2]) << 8)
                | (parseInt(parts[3]) << 0);
        }
    }

    //Properties
    public get intValue()
    {
        return this._intValue;
    }

    //Public methods
    public Equals(other: IPv4)
    {
        return this.intValue === other.intValue;
    }
    
    public Next()
    {
        return new IPv4(this._intValue + 1);
    }

    public Prev()
    {
        return new IPv4(this._intValue - 1);
    }

    public ToString()
    {
        const ip = this._intValue;

        const parts = [
            ip >>> 24,
            (ip >> 16) & 0xFF,
            (ip >> 8) & 0xFF,
            ip & 0xFF
        ];
        return parts.join(".");
    }

    //Private state
    private _intValue: number;
}