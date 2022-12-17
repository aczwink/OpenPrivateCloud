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
import { ModulesManager } from "./ModulesManager";
import { SSHCommandExecutor } from "./SSHCommandExecutor";
import { opcSpecialUsers } from "../common/UserAndGroupDefinitions";

@Injectable
export class HostsManager
{
    constructor(private localCommandExecutor: LocalCommandExecutor, private modulesManager: ModulesManager,
        private sshService: SSHService, private hostsController: HostsController, private sshCommandExecutor: SSHCommandExecutor)
    {
    }

    //Public methods
    public async TakeOverHost(hostName: string)
    {
        const pw = crypto.randomBytes(32).toString("hex");

        const conn = await this.sshService.ConnectWithCredentials(hostName, opcSpecialUsers.host, "opc");
        await this.ChangeUserPassword(conn, opcSpecialUsers.host, pw);
        conn.Close();

        const hostId = await this.hostsController.AddHost(hostName, pw);
        await this.modulesManager.EnsureModuleIsInstalled(hostId, "core");

        //await this.GenerateKeyPair(hostName);
        //await this.CopyPublicKeyToHost(hostName, hostName);
    }

    //Private methods
    private async ChangeUserPassword(conn: SSHConnection, oldPassword: string, newPassword: string)
    {
        let stdin = "";
        if(oldPassword.trim().length !== 0) //it is possible, that the user does not have a password before. In that case it should be blank
            stdin += (oldPassword + "\n");
        
        stdin += (newPassword + "\n");
        stdin += (newPassword + "\n");
        stdin += ("\n"); //in case the user had a password but oldPassword.length == 0, this will terminate passwd

        await this.sshCommandExecutor.ExecuteCommand(conn, ["passwd"], {
            hostId: -1,
            stdin,
        }); //TODO: hostid
    }

    private async CopyPublicKeyToHost(keyName: string, hostName: string)
    {
        //await this.localCommandExecutor.ExecuteCommand(["ssh-copy-id", "-i", "$HOME/.ssh/" + keyName + ".pub", "opc@" + hostName]);
        const pubKey = await fs.promises.readFile("/home/opc-controller/.ssh/" + keyName + ".pub", "utf-8");
        const conn = await this.sshService.ConnectWithCredentials(hostName, opcSpecialUsers.host, "opc");
        await conn.AppendFile("/home/opc/.ssh/authorized_keys", pubKey);

        await this.sshCommandExecutor.ExecuteCommand(conn, ["sudo", "passwd", "-d", opcSpecialUsers.host], { hostId: -1 }); //TODO: hostid
        await this.sshCommandExecutor.ExecuteCommand(conn, ["sudo", "passwd", "-l", opcSpecialUsers.host], { hostId: -1 }); //TODO: hostid

        conn.Close();
    }

    private async GenerateKeyPair(keyName: string)
    {
        await this.localCommandExecutor.ExecuteCommand(["ssh-keygen", "-f", "$HOME/.ssh/" + keyName, "-N", '""']);
    }
}