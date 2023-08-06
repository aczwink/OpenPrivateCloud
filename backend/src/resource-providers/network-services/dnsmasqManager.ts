/**
 * OpenPrivateCloud
 * Copyright (C) 2023 Amir Czwink (amir130@hotmail.de)
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
import { LightweightResourceReference } from "../../common/ResourceReference";
import { SystemServicesManager } from "../../services/SystemServicesManager";
import { ModulesManager } from "../../services/ModulesManager";
import { RemoteFileSystemManager } from "../../services/RemoteFileSystemManager";

interface dnsmasqConfig
{
    configDirPath: string;
    configContent: string,
    networkInterface: string
}

@Injectable
export class dnsmasqManager
{
    constructor(private systemServicesManager: SystemServicesManager, private modulesManager: ModulesManager, private remoteFileSystemManager: RemoteFileSystemManager)
    {
    }

    //Public methods
    public async DeleteService(resourceReference: LightweightResourceReference)
    {
        const serviceName = this.DeriveServiceName(resourceReference);
        const exists = await this.systemServicesManager.DoesServiceUnitExist(resourceReference.hostId, serviceName);
        if(exists)
        {
            await this.systemServicesManager.StopService(resourceReference.hostId, serviceName);
            await this.systemServicesManager.DeleteService(resourceReference.hostId, serviceName);
        }
    }

    public async IsServiceRunning(resourceReference: LightweightResourceReference)
    {
        const serviceName = this.DeriveServiceName(resourceReference);
        return await this.systemServicesManager.IsServiceActive(resourceReference.hostId, serviceName);
    }

    public async UpdateService(resourceReference: LightweightResourceReference, config: dnsmasqConfig)
    {
        const configFilePath = path.join(config.configDirPath, "dnsmasq.conf");
        const pidPath = path.join(config.configDirPath, "dnsmasq.pid");

        const configFileContent = `
        ${config.configContent}
bind-dynamic
except-interface=lo
interface=${config.networkInterface}
pid-file=${pidPath}
        `;
        await this.remoteFileSystemManager.WriteTextFile(resourceReference.hostId, configFilePath, configFileContent.trim());

        const serviceName = this.DeriveServiceName(resourceReference);
        const exists = await this.systemServicesManager.DoesServiceUnitExist(resourceReference.hostId, serviceName);
        if(!exists)
            await this.CreateService(resourceReference, configFilePath);
    }

    //Private methods
    private async CreateService(resourceReference: LightweightResourceReference, configPath: string)
    {
        const serviceName = this.DeriveServiceName(resourceReference);

        await this.modulesManager.EnsureModuleIsInstalled(resourceReference.hostId, "dnsmasq");

        await this.systemServicesManager.CreateOrUpdateService(resourceReference.hostId, {
            before: [],
            command: "dnsmasq --conf-file=" + configPath,
            environment: {},
            groupName: "root",
            name: serviceName,
            userName: "root"
        });
        await this.systemServicesManager.EnableService(resourceReference.hostId, serviceName);
        await this.systemServicesManager.StartService(resourceReference.hostId, serviceName);
    }

    private DeriveServiceName(resourceReference: LightweightResourceReference)
    {
        return "opc-rdnsmasq-" + resourceReference.id;
    }
}