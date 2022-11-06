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
import { InstancesManager } from "../../services/InstancesManager";
import { InstanceConfigController } from "../../data-access/InstanceConfigController";

export interface OpenVPNGatewayConfig
{
    domainName: string;
    keySize: number;   
}

@Injectable
export class OpenVPNGatewayManager
{
    constructor(private instancesManager: InstancesManager, private instanceConfigController: InstanceConfigController)
    {
    }
    
    //Public methods
    public GetPKIPath(storagePath: string, fullInstanceName: string)
    {
        const instancePath = this.instancesManager.BuildInstanceStoragePath(storagePath, fullInstanceName);

        return path.join(instancePath, "pki");
    }

    public async ReadConfig(instanceId: number): Promise<OpenVPNGatewayConfig>
    {
        const config = await this.instanceConfigController.RequestConfig<OpenVPNGatewayConfig>(instanceId);
        return config!;
    }
}