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

import { Injectable } from "acts-util-node";
import { RemoteCommandExecutor } from "./RemoteCommandExecutor";

  
@Injectable
export class DistroInfoService
{
    constructor(private remoteCommandExecutor: RemoteCommandExecutor)
    {
    }

    //Public methods
    public async FetchCPU_Architecture(hostId: number): Promise<"amd64" | "arm64">
    {
        const result = await this.remoteCommandExecutor.ExecuteBufferedCommand(["dpkg", "--print-architecture"], hostId);
        return result.stdOut.trim() as any;
    }
    
    public async FetchDisplayName(hostId: number)
    {
        const result = await this.FetchFields(hostId);
        return result.PRETTY_NAME!;
    }
}