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

import { Injectable } from "acts-util-node";
import { RemoteCommandExecutor } from "../../services/RemoteCommandExecutor";
import { DistroPackageManager, ModuleName } from "../DistroPackageManager";

@Injectable
class DebianPackageManager implements DistroPackageManager
{
    constructor(private remoteCommandExecutor: RemoteCommandExecutor)
    {
    }

    //Private methods
    private async DoDebConfig(hostId: number, moduleName: ModuleName)
    {
        switch(moduleName)
        {
            case "samba":
                await this.SetDebConfValue(hostId, "samba-common", "samba-common/dhcp", false);
                break;
            case "webdav":
                await this.SetDebConfValue(hostId, "davfs2", "davfs2/suid_file", false);
                break;
        }
    }

    private MapModuleToPackageList(moduleName: ModuleName)
    {
        switch(moduleName)
        {
            case "core":
                return ["acl", "btrfs-progs", "nftables", "smartmontools", "unattended-upgrades", "unzip"];
            case "dnsmasq":
                return ["dnsmasq"];
            case "docker":
                return ["docker.io"];
            case "ffmpeg":
                return ["ffmpeg"];
            case "libvirt":
                return ["libosinfo-bin", "libvirt-daemon-system", "qemu-kvm", "virtinst"];
            case "mariadb":
                return ["mariadb-server"];
            case "node":
                return ["nodejs"];
            case "openvpn":
                return ["openvpn", "easy-rsa"];
            case "samba":
                return ["samba", "samba-common-bin"];
            case "webdav":
                return ["davfs2"];
            default:
                throw new Error("Unknown module: " + moduleName);
        }
    }

    private async SetDebConfValue(hostId: number, packageName: string, key: string, value: boolean | string[])
    {
        let input = packageName + " " + key + " ";
        if(typeof value === "boolean")
            input += "boolean " + value.toString();
        else
            input += "multiselect " + value.join(", ");
            
        await this.remoteCommandExecutor.ExecuteCommand({
            source: ["echo", input],
            target: ["debconf-set-selections"],
            type: "pipe",
            sudo: true,
        }, hostId);
    }
}

export default DebianPackageManager;