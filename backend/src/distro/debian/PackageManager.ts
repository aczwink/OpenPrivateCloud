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
import { DistroPackageManager, ModuleName } from "../DistroPackageManager";

@Injectable
class DebianPackageManager implements DistroPackageManager
{
    constructor(private remoteCommandExecutor: RemoteCommandExecutor)
    {
    }

    //Public methods
    public async Install(hostId: number, moduleName: ModuleName)
    {
        await this.DoDebConfig(hostId, moduleName);
        await this.remoteCommandExecutor.ExecuteCommand(["sudo", "apt", "-y", "install", this.MapModuleToPackageList(moduleName).join(" ")], hostId);
    }

    public async IsModuleInstalled(hostId: number, moduleName: ModuleName): Promise<boolean>
    {
        const installedPackages = await this.FetchInstalledPackages(hostId);
        const packages = this.MapModuleToPackageList(moduleName);
        for (const packageName of packages)
        {
            const installed = await this.IsPackageInstalled(hostId, installedPackages, packageName);
            if(!installed)
                return false;
        }
        return true;
    }

    public async Uninstall(hostId: number, moduleName: ModuleName)
    {
        await this.remoteCommandExecutor.ExecuteCommand(["sudo", "apt", "-y", "purge", this.MapModuleToPackageList(moduleName).join(" ")], hostId);
        await this.remoteCommandExecutor.ExecuteCommand(["sudo", "apt", "-y", "autoremove"], hostId);
    }

    //Private methods
    private async DoDebConfig(hostId: number, moduleName: ModuleName)
    {
        switch(moduleName)
        {
            /*case "phpmyadmin":
                await this.SetDebConfValue("phpmyadmin", "phpmyadmin/dbconfig-install", false);
                await this.SetDebConfValue("phpmyadmin", "phpmyadmin/dbconfig-remove", false);
                await this.SetDebConfValue("phpmyadmin", "phpmyadmin/reconfigure-webserver", ["apache2"]);
                break;*/
            case "samba":
                await this.SetDebConfValue(hostId, "samba-common", "samba-common/dhcp", false);
                break;
        }
    }

    private async FetchInstalledPackages(hostId: number)
    {
        const aptResult = await this.remoteCommandExecutor.ExecuteBufferedCommand(["apt", "list", "--installed"], hostId);
        const lines = aptResult.stdOut.split("\n");

        const result = [];
        for (let index = 0; index < lines.length; index++)
        {
            const line = lines[index];
            const parts = line.split("/");
            if(parts.length > 0)
                result.push(parts[0].trim());
        }
        return result;
    }

    private async IsPackageInstalled(hostId: number, installedPackages: string[], packageName: string): Promise<boolean>
    {
        const allPackages = installedPackages;
        if(allPackages.Contains(packageName))
            return true;

        //check if it is a virtual package
        const result = await this.remoteCommandExecutor.ExecuteBufferedCommand(["apt-cache", "showpkg", packageName], hostId);
        const literal = "Reverse Provides:";
        const pos = result.stdOut.indexOf(literal) + literal.length;
        const reverseProvidesPart = result.stdOut.substring(pos).trimStart().split("\n");
        const providers = [];
        for (const line of reverseProvidesPart)
        {
            providers.push(line.split(" ")[0]);
        }
        const childrenResults = await providers.Values().Distinct(x => x).Filter(x => x.length > 0).Map(x => this.IsPackageInstalled(hostId, installedPackages, x)).PromiseAll();

        return childrenResults.Values().Any();
    }

    private MapModuleToPackageList(moduleName: ModuleName)
    {
        switch(moduleName)
        {
            case "core":
                return ["smartmontools", "unattended-upgrades"];
            case "libvirt":
                return ["libosinfo-bin", "libvirt-daemon-system", "qemu-kvm"];
            case "openvpn":
                return ["openvpn", "easy-rsa"];
            case "samba":
                return ["samba"];
            /*case "apache":
                return ["apache2"];
            case "cifs":
                return ["cifs-utils"];
            case "jdownloader":
                return ["openjdk-11-jre-headless"];
            case "letsencrypt":
                return ["certbot"];
            case "mariadb":
                return ["mariadb-server"];
            case "nextcloud":
                return ["php", "php-mysql", "php-zip", "php-xml", "php-mbstring", "php-gd", "php-curl"];
            case "phpmyadmin":
                return ["phpmyadmin", "libapache2-mod-php"];
            */
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

        await this.remoteCommandExecutor.ExecuteCommand(["echo", '"' + input + '"', "|", "sudo", "debconf-set-selections"], hostId);
    }
}

export default DebianPackageManager;