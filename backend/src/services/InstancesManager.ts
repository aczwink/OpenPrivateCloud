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
import { RemoteFileSystemManager } from "./RemoteFileSystemManager";
import { RemoteRootFileSystemManager } from "./RemoteRootFileSystemManager";
 
@Injectable
export class InstancesManager
{
    constructor(private remoteFileSystemManager: RemoteFileSystemManager, private remoteRootFileSystemManager: RemoteRootFileSystemManager)
    {
    }
    
    //Public methods
    public BuildInstanceStoragePath(hostStoragePath: string, fullInstanceName: string)
    {
        return path.join(hostStoragePath, this.DeriveInstanceFileNameFromUniqueInstanceName(fullInstanceName));
    }
    
    public async CreateInstanceStorageDirectory(hostId: number, hostStoragePath: string, fullInstanceName: string)
    {
        const instancePath = this.BuildInstanceStoragePath(hostStoragePath, fullInstanceName);
        await this.remoteFileSystemManager.CreateDirectory(hostId, instancePath, {
            mode: 0o770 //bug in ssh2? attributes does not seem to be set
        });
        await this.remoteFileSystemManager.ChangeMode(hostId, instancePath, 0o770);

        return instancePath;
    }

    public CreateUniqueInstanceName(resourceProviderName: string, instanceType: string, instanceName: string)
    {
        return "/" + resourceProviderName + "/" + instanceType + "/" + instanceName;
    }

    public DeriveInstanceFileNameFromUniqueInstanceName(fullInstanceName: string)
    {
        return fullInstanceName.substring(1).ReplaceAll("/", "-");
    }

    public ExtractPartsFromFullInstanceName(fullInstanceName: string)
    {
        const parts = fullInstanceName.substring(1).split("/");
        return {
            resourceProviderName: parts[0],
            resourceTypeName: parts[1],
            instanceName: parts[2]
        };
    }

    public async RemoveInstanceStorageDirectory(hostId: number, hostStoragePath: string, fullInstanceName: string)
    {
        const instancePath = this.BuildInstanceStoragePath(hostStoragePath, fullInstanceName);
        await this.remoteRootFileSystemManager.RemoveDirectoryRecursive(hostId, instancePath);
    }
}