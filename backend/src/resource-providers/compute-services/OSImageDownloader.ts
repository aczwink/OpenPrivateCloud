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
import { AbsURL } from "acts-util-core";
import { HTTP, Injectable } from "acts-util-node";
import { RemoteFileSystemManager } from "../../services/RemoteFileSystemManager";
import { OSInfo } from "./OSQueryService";
import { RemoteCommandExecutor } from "../../services/RemoteCommandExecutor";

 
@Injectable
export class OSImageDownloader
{
    constructor(private remoteFileSystemManager: RemoteFileSystemManager, private remoteCommandExecutor: RemoteCommandExecutor)
    {
    }

    //Public methods
    public async DownloadImage(osInfo: OSInfo, hostId: number, dirPath: string)
    {
        let result: { fileName: string; downloadURL: string };
        switch(osInfo.type)
        {
            case "ubuntu":
            case "ubuntu-server":
                result = await this.DownloadUbuntuImage(osInfo);
                break;
        }

        const localPath = path.join(dirPath, result.fileName);
        try
        {
            await this.remoteFileSystemManager.QueryStatus(hostId, localPath);
        }
        catch(_)
        {
            await this.remoteCommandExecutor.ExecuteCommand(["wget", result.downloadURL, "-P", dirPath], hostId);
        }

        return localPath;
    }

    //Private methods
    private async DownloadUbuntuImage(osInfo: OSInfo)
    {
        const requestSender = new HTTP.RequestSender();
        const response = await requestSender.SendRequest({
            body: Buffer.alloc(0),
            headers: {},
            method: "GET",
            url: new AbsURL({
                host: "releases.ubuntu.com",
                path: "/" + osInfo.versionString + "/",
                port: 443,
                protocol: "https",
                queryParams: {}
            })
        });

        const body = response.body.toString("utf-8");
        const isos = /href="(.*?\.iso)"/g.MatchAll(body).Map(x => x.groups[0]).Distinct(x => x);

        let flavorName: string;
        switch(osInfo.type)
        {
            case "ubuntu":
                flavorName = "desktop";
                break;
            case "ubuntu-server":
                flavorName = "server";
                break;
            default:
                throw new Error("not implemented");
        }
        const matchingIsos = isos.Filter(x => x.includes(flavorName)).ToArray();
        if(matchingIsos.length != 1)
            throw new Error("unknown number of matching isos");

        const fileName = matchingIsos[0];
        return {
            fileName,
            downloadURL: "https://releases.ubuntu.com/" + osInfo.versionString + "/" + fileName,
        };
    }
}