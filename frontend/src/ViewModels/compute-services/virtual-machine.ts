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

import { resourceProviders } from "openprivatecloud-common";
import { VMInfo } from "../../../dist/api";
import { MultiPageViewModel, ObjectViewModel } from "../../UI/ViewModel";

type ResourceAndGroupId = { resourceGroupName: string; resourceName: string };

function BuildResourceId(resourceGroupName: string, resourceName: string)
{
    return "/" + resourceGroupName + "/" + resourceProviders.computeServices.name + "/" + resourceProviders.computeServices.virtualMachineResourceType.name + "/" + resourceName;
}

const overviewViewModel: ObjectViewModel<VMInfo, ResourceAndGroupId>  = {
    type: "object",
    actions: [
        {
            type: "activate",
            execute: (service, ids) => service.resourceProviders._any_.computeservices.virtualmachine._any_.post(ids.resourceGroupName, ids.resourceName, { action: "start"}),
            matIcon: "play_arrow",
            title: "Start"
        },
        {
            type: "activate",
            execute: (service, ids) => service.resourceProviders._any_.computeservices.virtualmachine._any_.post(ids.resourceGroupName, ids.resourceName, { action: "shutdown"}),
            matIcon: "power_settings_new",
            title: "Shutdown"
        },
        {
            type: "activate",
            execute: (service, ids) => service.resourceProviders._any_.computeservices.virtualmachine._any_.post(ids.resourceGroupName, ids.resourceName, { action: "destroy"}),
            matIcon: "dangerous",
            title: "Force shutdown"
        }
    ],
    formTitle: _ => "Overview",
    requestObject: (service, ids) => service.resourceProviders._any_.computeservices.virtualmachine._any_.info.get(ids.resourceGroupName, ids.resourceName),
    schemaName: "VMInfo",
};

export const virtualMachineViewModel: MultiPageViewModel<ResourceAndGroupId> = {
    actions: [
        {
            type: "delete",
            deleteResource: (service, ids) => service.resourceGroups._any_.resources.delete(ids.resourceGroupName, { resourceId: BuildResourceId(ids.resourceGroupName, ids.resourceName) })
        }
    ],
    entries: [
        {
            displayName: "",
            entries: [
                {
                    key: "overview",
                    displayName: "Overview",
                    child: overviewViewModel,
                    icon: {
                        name: "dvr",
                        type: "material"
                    }
                }
            ]
        }
    ],
    formTitle: ids => ids.resourceName,
    type: "multiPage"
};