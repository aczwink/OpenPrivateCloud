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
import crypto from "crypto";
import { Injectable } from "acts-util-node";
import { SSHConnection, SSHService } from "./SSHService";
import { HostsController } from "../data-access/HostsController";
import { ModulesManager } from "./ModulesManager";
import { SSHCommandExecutor } from "./SSHCommandExecutor";
import { opcSpecialUsers } from "../common/UserAndGroupDefinitions";
import { HostFirewallSettingsManager } from "./HostFirewallSettingsManager";
import { HostsManager } from "./HostsManager";

@Injectable
export class HostTakeOverService
{
    constructor(private modulesManager: ModulesManager, private hostFirewallSettingsManager: HostFirewallSettingsManager,
        private sshService: SSHService, private hostsController: HostsController, private sshCommandExecutor: SSHCommandExecutor, private hostsManager: HostsManager)
    {
    }

    //Public methods
    public async Reconnect(hostId: number, hostName: string, password: string)
    {
        const newPassword = await this.ChangePasswordOnRemoteHost(hostName, password);
        this.hostsManager.SetHostPassword(hostId, newPassword);
    }

    public async TakeOverHost(hostName: string, password: string)
    {
        const newPassword = await this.ChangePasswordOnRemoteHost(hostName, password);

        const hostId = await this.hostsController.AddHost(hostName);
        this.hostsManager.SetHostPassword(hostId, newPassword);
        
        await this.modulesManager.EnsureModuleIsInstalled(hostId, "core");

        //enable firewall and make sure ssh is reachable
        await this.hostFirewallSettingsManager.SetRule(hostId, "Inbound", {
            priority: 100,
            destinationPortRanges: "22",
            protocol: "TCP",
            source: "Any",
            destination: "Any",
            action: "Allow",
            comment: "SSH. Required for host management. Do not touch!"
        });
        await this.hostFirewallSettingsManager.SetRule(hostId, "Inbound", {
            priority: 101,
            destinationPortRanges: "Any",
            protocol: "ICMP",
            source: "Any",
            destination: "Any",
            action: "Allow",
            comment: "Ping. Recommended for diagnosis"
        });

        //await this.GenerateKeyPair(hostName);
        //await this.CopyPublicKeyToHost(hostName, hostName);
    }

    //Private methods
    private async ChangePasswordOnRemoteHost(hostName: string, oldPassword: string)
    {
        const newPassword = crypto.randomBytes(31).toString("hex") + "#";

        const conn = await this.sshService.ConnectWithCredentials(hostName, opcSpecialUsers.host.name, oldPassword);
        await this.ChangeUserPassword(conn, oldPassword, newPassword);
        conn.Close();

        return newPassword;
    }

    private async ChangeUserPassword(conn: SSHConnection, oldPassword: string, newPassword: string)
    {
        let stdin = "";
        if(oldPassword.trim().length !== 0) //it is possible, that the user does not have a password before. In that case it should be blank
            stdin += (oldPassword + "\n");
        
        stdin += (newPassword + "\n");
        stdin += (newPassword + "\n");
        stdin += ("\n"); //in case the user had a password but oldPassword.length == 0, this will terminate passwd

        await this.sshCommandExecutor.ExecuteCommand(conn, ["passwd"], {
            hostIdOrHostName: "TODO: Unknown",
            stdin,
        }); //TODO: hostid
    }

    /*private async CopyPublicKeyToHost(keyName: string, hostName: string)
    {
        //await this.localCommandExecutor.ExecuteCommand(["ssh-copy-id", "-i", "$HOME/.ssh/" + keyName + ".pub", "opc@" + hostName]);
        const pubKey = await fs.promises.readFile("/home/opc-controller/.ssh/" + keyName + ".pub", "utf-8");
        const conn = await this.sshService.ConnectWithCredentials(hostName, opcSpecialUsers.host.name, "opc");
        await conn.AppendFile("/home/opc/.ssh/authorized_keys", pubKey);

        await this.sshCommandExecutor.ExecuteCommand(conn, ["sudo", "passwd", "-d", opcSpecialUsers.host.name], { hostIdOrHostName: hostName });
        await this.sshCommandExecutor.ExecuteCommand(conn, ["sudo", "passwd", "-l", opcSpecialUsers.host.name], { hostIdOrHostName: hostName });

        conn.Close();
    }

    private async GenerateKeyPair(keyName: string)
    {
        await this.localCommandExecutor.ExecuteCommand(["ssh-keygen", "-f", "$HOME/.ssh/" + keyName, "-N", '""']);
    }*/
}