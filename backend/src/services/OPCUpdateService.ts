/**
 * OpenPrivateCloud
 * Copyright (C) 2024 Amir Czwink (amir130@hotmail.de)
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
import { LocalCommandExecutor } from "./LocalCommandExecutor";

@Injectable
export class OPCUpdateService
{
    constructor(private localCommandExecutor: LocalCommandExecutor)
    {
    }

    //Public methods
    public async ExecuteSoftwareUpdate()
    {
        const path = "/srv/opc";

        const result = await this.localCommandExecutor.ExecuteCommand(["stat", "-c", "%U", path]);
        const owner = result.stdout.trim();
        //TODO: find real path
        await this.localCommandExecutor.ExecuteCommand(["sudo", "-u", owner, "./controller_update.sh"], path);
    }
}