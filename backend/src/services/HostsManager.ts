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
import crypto from "crypto";
import fs from "fs";
import { Injectable } from "acts-util-node";
import { LocalCommandExecutor } from "./LocalCommandExecutor";
import { SSHConnection, SSHService } from "./SSHService";
import { HostsController } from "../data-access/HostsController";
import { HostStoragesManager } from "./HostStoragesManager";
import { ModulesManager } from "./ModulesManager";

@Injectable
export class HostsManager
{
    constructor(private localCommandExecutor: LocalCommandExecutor, private modulesManager: ModulesManager,
        private sshService: SSHService, private hostsController: HostsController)
    {
    }

    //Public methods
    public async TakeOverHost(hostName: string)
    {
        const pw = crypto.randomBytes(32).toString("hex");

        const conn = await this.sshService.ConnectWithCredentials(hostName, "opc", "opc");
        await this.ChangeUserPassword(conn, "opc", pw);
        conn.Close();

        const hostId = await this.hostsController.AddHost(hostName, pw);
        await this.modulesManager.EnsureModuleIsInstalled(hostId, "core");

        //await this.GenerateKeyPair(hostName);
        //await this.CopyPublicKeyToHost(hostName, hostName);
    }

    //Private methods
    private async ChangeUserPassword(conn: SSHConnection, oldPassword: string, newPassword: string)
    {
        const channel = await conn.ExecuteInteractiveCommand(["passwd"]);
        if(oldPassword.trim().length !== 0) //it is possible, that the user does not have a password before. In that case it should be blank
            channel.stdin.write(oldPassword + "\n");
        channel.stdin.write(newPassword + "\n");
        channel.stdin.write(newPassword + "\n");
        channel.stdin.write("\n"); //in case the user had a password but oldPassword.length == 0, this will terminate passwd

        return new Promise<boolean>( (resolve, reject) => {
            channel.on("exit", code => resolve(code === "0"));
            channel.on("error", reject);
        });
    }

    private async CopyPublicKeyToHost(keyName: string, hostName: string)
    {
        //await this.localCommandExecutor.ExecuteCommand(["ssh-copy-id", "-i", "$HOME/.ssh/" + keyName + ".pub", "opc@" + hostName]);
        const pubKey = await fs.promises.readFile("/home/opc-controller/.ssh/" + keyName + ".pub", "utf-8");
        const conn = await this.sshService.ConnectWithCredentials(hostName, "opc", "opc");
        await conn.AppendFile("/home/opc/.ssh/authorized_keys", pubKey);

        conn.ExecuteCommand(["sudo", "passwd", "-d", "opc"]);
        conn.ExecuteCommand(["sudo", "passwd", "-l", "opc"]);
        conn.Close();
    }

    private async GenerateKeyPair(keyName: string)
    {
        await this.localCommandExecutor.ExecuteCommand(["ssh-keygen", "-f", "$HOME/.ssh/" + keyName, "-N", '""']);
    }
}