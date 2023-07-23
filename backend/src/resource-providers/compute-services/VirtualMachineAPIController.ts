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

import { APIController, BodyProp, Common, Get, Path, Post } from "acts-util-apilib";
import { c_computeServicesResourceProviderName, c_virtualMachineResourceTypeName } from "openprivatecloud-common/dist/constants";
import { ResourcesManager } from "../../services/ResourcesManager";
import { VirtualMachineManager } from "./VirtualMachineManager";
import { ResourceAPIControllerBase } from "../ResourceAPIControllerBase";
import { ResourceReference } from "../../common/ResourceReference";


interface VMInfo
{
    hostName: string;
    storagePath: string;
    state: string;
}
 
@APIController(`resourceProviders/{resourceGroupName}/${c_computeServicesResourceProviderName}/${c_virtualMachineResourceTypeName}/{resourceName}`)
class VirtualMachineAPIController extends ResourceAPIControllerBase
{
    constructor(instancesManager: ResourcesManager, private virtualMachineManager: VirtualMachineManager)
    {
        super(instancesManager, c_computeServicesResourceProviderName, c_virtualMachineResourceTypeName);
    }

    @Common()
    public async ExtractCommonAPIData(
        @Path resourceGroupName: string,
        @Path resourceName: string
    )
    {
        return this.FetchResourceReference(resourceGroupName, resourceName);
    }

    @Post()
    public async ExecuteVMAction(
        @Common resourceReference: ResourceReference,
        @BodyProp action: "destroy" | "start" | "shutdown"
    )
    {
        await this.virtualMachineManager.ExecuteAction(resourceReference, action);
    }

    @Get("info")
    public async QueryVMInfo(
        @Common resourceReference: ResourceReference
    )
    {            
        const state = await this.virtualMachineManager.QueryVMState(resourceReference);
        const result: VMInfo = {
            hostName: resourceReference.hostName,
            state: state!,
            storagePath: resourceReference.hostStoragePath
        };
        return result;
    }
}