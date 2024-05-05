/**
 * OpenPrivateCloud
 * Copyright (C) 2019-2024 Amir Czwink (amir130@hotmail.de)
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

export interface CA_Config
{
    commonName: string;
    keySize: 2048 | 4096;
}

export interface CA_FilePaths
{
    caCertPath: string;
    dhPath: string;
    crlPath: string;
}

export interface CertKeyPaths
{
    certPath: string;
    keyPath: string;
}

@Injectable
export class EasyRSAManager
{
    constructor(private remoteCommandExecutor: RemoteCommandExecutor)
    {
    }

    //Public methods
    public async CreateCA(hostId: number, caDir: string, caConfig: CA_Config)
    {
        await this.remoteCommandExecutor.ExecuteCommand(["make-cadir", caDir], hostId);
        await this.remoteCommandExecutor.ExecuteCommand(["./easyrsa init-pki"], hostId, {
            workingDirectory: caDir
        });

        const shell = await this.remoteCommandExecutor._LegacySpawnShell(hostId);
        await shell.ChangeDirectory(caDir);

        await shell.ExecuteCommand(["./easyrsa", "--batch", "--keysize=" + caConfig.keySize, "--req-cn=" + caConfig.commonName, "build-ca", "nopass"]);
        await shell.ExecuteCommand(["./easyrsa", "gen-crl"]);
        await shell.ExecuteCommand(["./easyrsa", "--batch", "--keysize=" + caConfig.keySize, "gen-dh"]);

        await shell.Close();
    }

    public async CreateClientKeyPair(hostId: number, cadir: string, clientName: string)
    {
        await this.remoteCommandExecutor.ExecuteCommand(["./easyrsa", "--batch", "--req-cn=" + clientName, "build-client-full", clientName, "nopass"], hostId, {
            workingDirectory: cadir
        });
    }

    public async CreateServerKeyPair(hostId: number, cadir: string, serverName: string, keySize: number)
    {
        await this.remoteCommandExecutor.ExecuteCommand(["./easyrsa", "--batch", "--keysize=" + keySize, "build-server-full", serverName, "nopass"], hostId, {
            workingDirectory: cadir
        });
    }

    public GetCAPaths(cadir: string): CA_FilePaths
    {
        const pkiPath = path.join(cadir, "pki");
        return {
            caCertPath: path.join(pkiPath, "ca.crt"),
            crlPath: path.join(pkiPath, "crl.pem"),
            dhPath: path.join(pkiPath, "dh.pem"),
        };
    }

    public GetCertAndKeyPaths(cadir: string, name: string): CertKeyPaths
    {
        const pkiPath = path.join(cadir, "pki");
        return {
            certPath: path.join(pkiPath, "issued", name + ".crt"),
            keyPath: path.join(pkiPath, "private", name + ".key"),
        };
    }

    public async RevokeCertificate(hostId: number, cadir: string, name: string)
    {
        const shell = await this.remoteCommandExecutor._LegacySpawnShell(hostId);
        await shell.ChangeDirectory(cadir);

        await shell.ExecuteCommand(["./easyrsa", "--batch", "revoke", name]);
        await shell.ExecuteCommand(["./easyrsa", "gen-crl"]);

        await shell.Close();
    }

    public async UpdateCRL(hostId: number, cadir: string)
    {
        await this.remoteCommandExecutor.ExecuteCommand(["./easyrsa", "gen-crl"], hostId, {
            workingDirectory: cadir
        });
    }
}