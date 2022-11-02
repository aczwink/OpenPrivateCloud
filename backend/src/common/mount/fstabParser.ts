/**
 * OpenPrivateCloud
 * Copyright (C) 2019-2022 Amir Czwink (amir130@hotmail.de)
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


export interface FileSystemEntry
{
    fileSystem: string;
    mountPoint: string;
    type: string;
    options: string;
    dump: number;
    pass: number;
}

export class fstabParser
{
    //Public methods
    public Parse(input: string)
    {
        const lines = input.split("\n");

        const entries: FileSystemEntry[] = [];
        for (const line of lines)
        {
            if(line.startsWith("#"))
                continue;
            if(line.trim().length == 0)
                continue;

            const parts = line.split(" ").filter(str => str.length > 0);

            entries.push({
                fileSystem: parts[0],
                mountPoint: parts[1],
                type: parts[2],
                options: parts[3],
                dump: parseInt(parts[4]),
                pass: parseInt(parts[5]),
            });
        }

        return entries;
    }
}