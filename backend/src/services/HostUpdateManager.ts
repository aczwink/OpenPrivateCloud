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
import { ConfigDialect } from "../common/config/ConfigDialect";
import { ConfigModel } from "../common/config/ConfigModel";
import { ConfigParser, KeyValueEntry } from "../common/config/ConfigParser";
import { ConfigWriter } from "../common/config/ConfigWriter";
import { RemoteCommandExecutor } from "./RemoteCommandExecutor";
import { RemoteRootFileSystemManager } from "./RemoteRootFileSystemManager";

const autoUpgradeFilePath = "/etc/apt/apt.conf.d/20auto-upgrades";
const autoUpgradeConfigDialect: ConfigDialect = {
    commentInitiators: [],
};

class AutoUpgradeFileParser extends ConfigParser
{
    protected override ParseKeyValue(line: string): KeyValueEntry
    {
        const parts = line.TrimRight(";").split(" ");
        return {
            type: "KeyValue",
            key: parts[0],
            value: parts[1].TrimLeft('"').TrimRight('"')
        };
    }
}

class AutoUpgradeFileWriter extends ConfigWriter
{
    protected override KeyValueEntryToString(entry: KeyValueEntry)
    {
        return entry.key + " " + entry.value + ";";
    }
}

@Injectable
export class HostUpdateManager
{
    constructor(private remoteCommandExecutor: RemoteCommandExecutor, private remoteRootFileSystemManager: RemoteRootFileSystemManager)
    {
    }
    
    //Public methods
    public async QueryUpdateInfo(hostId: number)
    {
        await this.remoteCommandExecutor.ExecuteCommand(["sudo", "apt-get", "update"], hostId);
        const result = await this.remoteCommandExecutor.ExecuteBufferedCommand(["apt", "list", "--upgradeable"], hostId);

        const config = await this.ParseUnattendedUpgradeConfig(hostId);
        
        return {
            config,
            updatablePackagesCount: result.stdOut.split("\n").length - 2
        };
    }

    public async SetUnattendedUpgradeConfig(hostId: number, unattendedUpgrades: boolean, updatePackageLists: boolean)
    {
        const cfgEntries = await this.ReadConfig(hostId);
        const cfgModel = new ConfigModel(cfgEntries);

        cfgModel.SetProperty("", "APT::Periodic::Unattended-Upgrade", this.BoolToNumberString(unattendedUpgrades));
        cfgModel.SetProperty("", "APT::Periodic::Update-Package-Lists", this.BoolToNumberString(updatePackageLists));

        const configWriter = new AutoUpgradeFileWriter(autoUpgradeConfigDialect, (filePath, content) => this.remoteRootFileSystemManager.WriteTextFile(hostId, filePath, content));
        await configWriter.Write(autoUpgradeFilePath, cfgEntries);
    }

    public async UpdateSystem(hostId: number)
    {
        await this.remoteCommandExecutor.ExecuteCommand(["sudo", "apt-get", "-y", "upgrade"], hostId);
        await this.remoteCommandExecutor.ExecuteCommand(["sudo", "apt-get", "-y", "autoremove"], hostId);
        await this.remoteCommandExecutor.ExecuteCommand(["sudo", "apt-get", "autoclean"], hostId);
    }

    //Private methods
    private BoolToNumberString(b: boolean)
    {
        const n = b ? 1 : 0;

        return '"' + n + '"';
    }

    private async ParseUnattendedUpgradeConfig(hostId: number)
    {
        const cfgEntries = await this.ReadConfig(hostId);
        const cfgModel = new ConfigModel(cfgEntries);

        return {
            unattendedUpgrades: parseInt(cfgModel.WithoutSectionAsDictionary()["APT::Periodic::Unattended-Upgrade"] as string) === 1,
            updatePackageLists: parseInt(cfgModel.WithoutSectionAsDictionary()["APT::Periodic::Update-Package-Lists"] as string) === 1,
        };
    }

    private async ReadConfig(hostId: number)
    {
        const parser = new AutoUpgradeFileParser(autoUpgradeConfigDialect);
        return await parser.Parse(hostId, autoUpgradeFilePath);
    }
}