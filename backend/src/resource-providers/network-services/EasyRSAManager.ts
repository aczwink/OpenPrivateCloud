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
import { RemoteCommandExecutor } from "../../services/RemoteCommandExecutor";

@Injectable
export class EasyRSAManager
{
    constructor(private remoteCommandExecutor: RemoteCommandExecutor)
    {
    }

    //Public methods
    public async CreateCA(hostId: number, cadir: string, caCommonName: string, keySize: number)
    {
        const shell = await this.remoteCommandExecutor.SpawnShell(hostId);
        shell.ChangeDirectory(cadir);

        shell.SendCommand(["./easyrsa", "--batch", "--keysize=" + keySize, "--req-cn=" + caCommonName, "build-ca", "nopass"]);
        shell.SendCommand(["./easyrsa", "gen-crl"]);
        shell.SendCommand(["./easyrsa", "--batch", "--keysize=" + keySize, "gen-dh"]);

        await shell.Close();
    }

    public async CreateCADir(hostId: number, cadir: string)
    {
        await this.remoteCommandExecutor.ExecuteCommand(["make-cadir", cadir], hostId);

        const shell = await this.remoteCommandExecutor.SpawnShell(hostId);
        shell.ChangeDirectory(cadir);
        shell.SendCommand(["./easyrsa init-pki"]);
        await shell.Close();
    }
}