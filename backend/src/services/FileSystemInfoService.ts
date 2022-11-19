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

import { Injectable } from "acts-util-node";
import { RemoteCommandExecutor } from "./RemoteCommandExecutor";
 
@Injectable
export class FileSystemInfoService
{
    constructor(private remoteCommandExecutor: RemoteCommandExecutor)
    {
    }

    //Public methods
    public async QueryFileSystemInfoForDirectory(hostId: number, path: string)
    {
        const result = await this.remoteCommandExecutor.ExecuteBufferedCommand(["df", "-T", path], hostId);
        const lines = result.stdOut.split("\n");
        lines.pop();
        const line = lines.pop()!;
        const parts = line.split(/[ \t]+/);

        const freeSpace = parseInt(parts[4]);
        const usedSpace = parseInt(parts[3])

        return {
            freeSpace,
            type: parts[1],
            usedSpace,
            totalSize: freeSpace + usedSpace
        };
    }
}