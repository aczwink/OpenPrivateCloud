/**
 * OpenPrivateCloud
 * Copyright (C) 2019-2023 Amir Czwink (amir130@hotmail.de)
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

import { Dictionary } from "acts-util-core";
import { Injectable } from "acts-util-node";
import { ConfigDialect } from "../../common/config/ConfigDialect";
import { ConfigModel } from "../../common/config/ConfigModel";
import { ConfigParser, PropertyType } from "../../common/config/ConfigParser";
import { ConfigWriter } from "../../common/config/ConfigWriter";
import { RemoteCommandExecutor } from "../../services/RemoteCommandExecutor";
import { RemoteRootFileSystemManager } from "../../services/RemoteRootFileSystemManager";
import { Share, ShareProperties } from "./models";
import { ConfigReducer } from "../../common/config/ConfigReducer";

type GlobalSettings = Dictionary<boolean | number | string | null>;

export interface SMBConnectionInfo
{
    /**
     * @format multi-line
     */
    fstab: string;
}

interface ShareData
{
    readUsers: string[];
    writeUsers: string[];
    shareName: string;
    sharePath: string;
    smbEncrypt: "default" | "required";
}

const smbConfDialect: ConfigDialect = {
    commentInitiators: ["#", ";"],
    boolMapping: {
        falseMapping: "no",
        trueMapping: "yes"
    }
};

/**
 * Defauls as defined in smb.conf: https://www.samba.org/samba/docs/current/man-html/smb.conf.5.html
 */
const defaultSmbConfShareProperties: ShareProperties = {
    allowGuests: false,
    browseable: true,
    comment: "",
    createMask: 0o744,
    directoryMask: 0o755,
    path: "",
    printable: false,
    smbEncrypt: "default",
    validUsers: [],
    writeable: false,
    writeList: [],
};

@Injectable
export class SambaSharesManager
{
    constructor(private remoteCommandExecutor: RemoteCommandExecutor, private remoteRootFileSystemManager: RemoteRootFileSystemManager)
    {
    }

    //Public methods
    public async DeleteShare(hostId: number, shareName: string)
    {
        const settings = await this.QueryConfig(hostId);
        const idx = settings.shares.findIndex(share => share.name === shareName);
        if(idx === -1)
            throw new Error("Share '" + shareName + "' does not exist.");
        settings.shares.Remove(idx);

        await this.WriteSettings(hostId, settings.global!, settings.shares);
    }

    public GetConnectionInfo(hostName: string, shareName: string, userName: string)
    {
        const result: SMBConnectionInfo = {
            fstab: `
for /etc/fstab:
//${hostName}/${shareName} /<some/local/path> cifs noauto,user,_netdev,credentials=/home/<your user>/.smbcredentials/${hostName} 0 0

for /home/<your user>/.smbcredentials/${hostName}:
username=${userName}
password=<your samba pw>
domain=WORKGROUP

protect /home/<your user>/.smbcredentials/${hostName} appropriatly!:
chmod 600 /home/<your user>/.smbcredentials/${hostName}
            `.trim()
        };

        return result;
    }

    public async QueryShareSettings(hostId: number, shareName: string)
    {
        const cfg = await this.QueryConfig(hostId);
        const share = cfg.shares.find(x => x.name === shareName);
        return share;
    }

    public async SetShare(hostId: number, data: ShareData)
    {
        const settings = await this.QueryConfig(hostId);
        const oldShare = settings.shares.find(share => share.name === data.shareName);
        const newShare = oldShare === undefined ? this.CreateDefaultShare(data.shareName) : oldShare;

        newShare.properties.createMask = 0o770;
        newShare.properties.directoryMask = 0o770;
        newShare.properties.path = data.sharePath;
        newShare.properties.validUsers = data.readUsers;
        newShare.properties.writeList = data.writeUsers;
        newShare.properties.smbEncrypt = data.smbEncrypt;

        if(oldShare === undefined)
            settings.shares.push(newShare);

        await this.WriteSettings(hostId, settings.global!, settings.shares);
    }

    //Private methods
    private CreateDefaultShare(shareName: string): Share
    {
        return {
            name: shareName,
            properties: {
                ...defaultSmbConfShareProperties,
            }
        };
    }
    
    private MapSectionToShare(sectionName: string, section: Dictionary<PropertyType>): Share
    {
        const share: Share = this.CreateDefaultShare(sectionName);
        const p = share.properties;

        for (const key in section)
        {
            if (section.hasOwnProperty(key))
            {
                const value = section[key]!;

                const b = value === true;
                const s = value.toString();
                const n8 = typeof value === "number" ? value : parseInt(s, 8);

                switch(key)
                {
                    case "browseable":
                        p.browseable = b;
                        break;
                    case "create mask":
                        p.createMask = n8;
                        break;
                    case "comment":
                        p.comment = s;
                        break;
                    case "directory mask":
                        p.directoryMask = n8;
                        break;
                    case "guest ok":
                        p.allowGuests = b;
                        break;
                    case "path":
                        p.path = s;
                        break;
                    case "printable":
                        p.printable = b;
                        break;
                    case "read only":
                        p.writeable = !b;
                        break;
                    case "smb encrypt":
                        p.smbEncrypt = s as any;
                        break;
                    case "valid users":
                        p.validUsers = s.split(" ");
                        break;
                    case "writable":
                    case "writeable":
                        p.writeable = b;
                        break;
                    case "write list":
                        p.writeList = s.split(" ");
                        break;
                    default:
                        throw new Error("Unknown property: " + key);
                }
            }
        }

        return share;
    }

    private async QueryConfig(hostId: number)
    {
        const parser = new ConfigParser(smbConfDialect);
        const data = await parser.Parse(hostId, "/etc/samba/smb.conf");

        const mdl = new ConfigModel(data);

        const sections = mdl.AsDictionary();
        const global = sections["global"];
        delete sections["global"];

        const shares = [];

        for (const key in sections)
        {
            if (sections.hasOwnProperty(key))
            {
                const section = sections[key];
                shares.push(this.MapSectionToShare(key, section!));
            }
        }

        return { global, shares };
    }

    private ToConfigObject(shareProperties: ShareProperties)
    {
        return {
            "guest ok": shareProperties.allowGuests,
            "browseable": shareProperties.browseable,
            comment: shareProperties.comment,
            "create mask": this.ToOctal(shareProperties.createMask),
            "directory mask": this.ToOctal(shareProperties.directoryMask),
            path: shareProperties.path,
            printable: shareProperties.printable,
            "smb encrypt": shareProperties.smbEncrypt,
            "valid users": shareProperties.validUsers.join(" "),
            writeable: shareProperties.writeable,
            "write list": shareProperties.writeList.join(" ")
        };
    }

    private ToOctal(n: number)
    {
        let string = n.toString(8);
        while(string.length < 4)
            string = "0" + string;

        return string;
    }

    private async WriteSettings(hostId: number, global: GlobalSettings, shares: Share[])
    {
        const parser = new ConfigParser(smbConfDialect);
        const cfgEntries = await parser.Parse(hostId, "/etc/samba/smb.conf");

        const mdl = new ConfigModel(cfgEntries);

        mdl.SetProperties("global", global);

        const defaultDict = this.ToConfigObject(defaultSmbConfShareProperties);
        const globalDict = mdl.SectionAsDictionary("global");

        const shareNamesToDelete = mdl.sectionNames.Filter(x => x !== "global").ToSet();
        for (const share of shares)
        {
            shareNamesToDelete.delete(share.name);

            const p = share.properties;

            mdl.DeleteProperties(share.name, ["writable"]); //delete aliases
            mdl.SetProperties(share.name, this.ToConfigObject(p));

            const configReducer = new ConfigReducer;
            configReducer.AddChild(defaultDict);
            configReducer.AddChild(globalDict);
            configReducer.AddChild(mdl.SectionAsDictionary(share.name));
            const redundant = configReducer.OptimizeLeaf();

            mdl.DeleteProperties(share.name, redundant);
        }

        for (const shareNameToDelete of shareNamesToDelete)
        {
            mdl.DeleteSection(shareNameToDelete.toString());
        }

        const writer = new ConfigWriter(smbConfDialect, (filePath, content) => this.remoteRootFileSystemManager.WriteTextFile(hostId, filePath, content));
        await writer.Write("/etc/samba/smb.conf", cfgEntries);

        await this.remoteCommandExecutor.ExecuteCommand(["sudo", "smbcontrol", "smbd", "reload-config"], hostId);
    }
}