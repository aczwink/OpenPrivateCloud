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
import path from "path";
import { Injectable } from "acts-util-node";
import { RemoteCommandExecutor } from "../../services/RemoteCommandExecutor";
import { RemoteFileSystemManager } from "../../services/RemoteFileSystemManager";

@Injectable
export class EasyRSAManager
{
    constructor(private remoteCommandExecutor: RemoteCommandExecutor, private remoteFileSystemManager: RemoteFileSystemManager)
    {
    }

    //Public methods
    public async AddClient(hostId: number, cadir: string, clientName: string)
    {
        const shell = await this.remoteCommandExecutor.SpawnShell(hostId);
        shell.ChangeDirectory(cadir);

        shell.SendCommand(["./easyrsa", "--batch", "--req-cn=" + clientName, "build-client-full", clientName, "nopass"]);

        await shell.Close();
    }

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

    public async CreateServer(hostId: number, cadir: string, domainName: string, keySize: number)
    {
        const shell = await this.remoteCommandExecutor.SpawnShell(hostId);
        shell.ChangeDirectory(cadir);
        
        shell.SendCommand(["./easyrsa", "--batch", "--keysize=" + keySize, "build-server-full", domainName, "nopass"]);

        await shell.Close();
    }

    public async ListClients(hostId: number, cadir: string, domainName: string)
    {
        const children = await this.remoteFileSystemManager.ListDirectoryContents(hostId, path.join(cadir, "pki/issued"));
        return children.Values()
            .Map(x => x.filename)
            .Map(child => child.substring(0, child.lastIndexOf(".")))
            .Filter(child => child !== domainName);
    }

    public async RevokeClient(hostId: number, cadir: string, clientName: string)
    {
        const shell = await this.remoteCommandExecutor.SpawnShell(hostId);
        shell.ChangeDirectory(cadir);

        shell.SendCommand(["./easyrsa", "--batch", "revoke", clientName]);
        shell.SendCommand(["./easyrsa", "gen-crl"]);

        await shell.Close();
    }
}