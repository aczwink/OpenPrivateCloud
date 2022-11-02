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

import { APIController, BodyProp, Common, Get, NotFound, Path, Post } from "acts-util-apilib";
import { c_computeServicesResourceProviderName, c_virtualMachineResourceTypeName } from "openprivatecloud-common/dist/constants";
import { HostsController } from "../../data-access/HostsController";
import { HostStorage, HostStoragesController } from "../../data-access/HostStoragesController";
import { InstancesController } from "../../data-access/InstancesController";
import { InstancesManager } from "../../services/InstancesManager";
import { VirtualMachineManager } from "./VirtualMachineManager";


interface VMInfo
{
    hostName: string;
    storagePath: string;
    state: string;
}
 
@APIController(`resourceProviders/${c_computeServicesResourceProviderName}/${c_virtualMachineResourceTypeName}/{instanceName}`)
class VirtualMachineAPIController
{
    constructor(private instancesController: InstancesController, private instancesManager: InstancesManager,
        private hostStoragesController: HostStoragesController, private hostsController: HostsController, private virtualMachineManager: VirtualMachineManager)
    {
    }

    @Common()
    public async ExtractCommonAPIData(
        @Path instanceName: string
    )
    {
        const fullInstanceName = this.instancesManager.CreateUniqueInstanceName(c_computeServicesResourceProviderName, c_virtualMachineResourceTypeName, instanceName);
        const instance = await this.instancesController.QueryInstance(fullInstanceName);
        if(instance === undefined)
            return NotFound("instance not found");

        const storage = await this.hostStoragesController.RequestHostStorage(instance!.storageId);

        return storage!;
    }

    @Post()
    public async ExecuteVMAction(
        @Common hostStorage: HostStorage,
        @Path instanceName: string,
        @BodyProp action: "destroy" | "start" | "shutdown"
    )
    {
        await this.virtualMachineManager.ExecuteAction(hostStorage.hostId, instanceName, action);
    }

    @Get("info")
    public async QueryVMInfo(
        @Common hostStorage: HostStorage,
        @Path instanceName: string
    )
    {
        const host = await this.hostsController.RequestHostCredentials(hostStorage.hostId);
            
        const result: VMInfo = {
            hostName: host!.hostName,
            state: await this.virtualMachineManager.QueryVMState(hostStorage.hostId, instanceName),
            storagePath: hostStorage.path
        };
        return result;
    }
}