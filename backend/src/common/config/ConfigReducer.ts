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

import { EqualsAny } from "acts-util-core";
import { PropertyType } from "./ConfigParser";

export class ConfigReducer
{
    constructor()
    {
        this.nodes = [];
    }

    //Public methods
    public AddChild(obj: any)
    {
        this.nodes.push(obj);
    }

    public OptimizeLeaf()
    {
        const toDelete = [];

        const leaf = this.nodes[this.nodes.length - 1];
        for (const key in leaf)
        {
            if (Object.prototype.hasOwnProperty.call(leaf, key))
            {
                const value = leaf[key];
                if(EqualsAny(value, this.GetValue(key, this.nodes.length - 2)))
                    toDelete.push(key);
            }
        }

        return toDelete;
    }

    //Private state
    private nodes: any[];

    //Private methods
    private GetValue(key: string, index: number): PropertyType | undefined
    {
        if(index < 0)
            return undefined;

        const v = this.nodes[index][key];
        if(v === undefined)
            return this.GetValue(key, index - 1);

        return v;
    }
}