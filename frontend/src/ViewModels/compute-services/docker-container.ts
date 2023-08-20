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
import { ContainerAppServiceConfigDTO, DockerContainerInfo, DockerContainerLogDto } from "../../../dist/api";
import { ExtractDataFromResponseOrShowErrorMessageOnError } from "../../UI/ResponseHandler";
import { MultiPageViewModel, ObjectViewModel } from "../../UI/ViewModel";
import { BuildCommonResourceActions, BuildResourceGeneralPageGroupEntry } from "../shared/resourcegeneral";

type ResourceAndGroupId = { resourceGroupName: string; resourceName: string };

function BuildResourceId(resourceGroupName: string, resourceName: string)
{
    return "/" + resourceGroupName + "/" + resourceProviders.computeServices.name + "/" + resourceProviders.computeServices.dockerContainerResourceType.name + "/" + resourceName;
}

const overviewViewModel: ObjectViewModel<DockerContainerInfo, ResourceAndGroupId>  = {
    type: "object",
    actions: [
        {
            type: "activate",
            execute: (service, ids) => service.resourceProviders._any_.computeservices.dockercontainer._any_.post(ids.resourceGroupName, ids.resourceName, { action: "start"}),
            matIcon: "play_arrow",
            title: "Start"
        },
        {
            type: "activate",
            execute: (service, ids) => service.resourceProviders._any_.computeservices.dockercontainer._any_.post(ids.resourceGroupName, ids.resourceName, { action: "shutdown"}),
            matIcon: "power_settings_new",
            title: "Shutdown"
        },
        {
            type: "activate",
            execute: (service, ids) => service.resourceProviders._any_.computeservices.dockercontainer._any_.update.post(ids.resourceGroupName, ids.resourceName),
            matIcon: "update",
            title: "Update"
        }
    ],
    formTitle: _ => "Overview",
    requestObject: (service, ids) => service.resourceProviders._any_.computeservices.dockercontainer._any_.info.get(ids.resourceGroupName, ids.resourceName),
    schemaName: "DockerContainerInfo",
};

const configViewModel: ObjectViewModel<ContainerAppServiceConfigDTO, ResourceAndGroupId> = {
    actions: [
        {
            type: "edit",
            propertiesSchemaName: "ContainerAppServiceConfigDTO",
            loadContext: async (service, ids) => {
                const response = await service.resourceProviders._any_.computeservices.dockercontainer._any_.info.get(ids.resourceGroupName, ids.resourceName);
                const result = ExtractDataFromResponseOrShowErrorMessageOnError(response);
                if(result.ok)
                    return result.value;
                return {
                    hostName: ""
                };
            },
            requestObject: async (service, ids) => service.resourceProviders._any_.computeservices.dockercontainer._any_.config.get(ids.resourceGroupName, ids.resourceName),
            updateResource: (service, ids, newValue) => service.resourceProviders._any_.computeservices.dockercontainer._any_.config.put(ids.resourceGroupName, ids.resourceName, newValue)
        }
    ],
    formTitle: _ => "Container configuration",
    requestObject: async (service, ids) => service.resourceProviders._any_.computeservices.dockercontainer._any_.config.get(ids.resourceGroupName, ids.resourceName),
    schemaName: "ContainerAppServiceConfigDTO",
    type: "object"
};

const logViewModel: ObjectViewModel<DockerContainerLogDto, ResourceAndGroupId> = {
    actions: [],
    formTitle: _ => "Container log",
    requestObject: async (service, ids) => service.resourceProviders._any_.computeservices.dockercontainer._any_.log.get(ids.resourceGroupName, ids.resourceName),
    schemaName: "DockerContainerLogDto",
    type: "object"
};

export const dockerContainerViewModel: MultiPageViewModel<ResourceAndGroupId> = {
    actions: [
        ...BuildCommonResourceActions(BuildResourceId),
    ],
    entries: [
        {
            displayName: "",
            entries: [
                {
                    key: "overview",
                    displayName: "Overview",
                    child: overviewViewModel
                },
                {
                    key: "config",
                    displayName: "Config",
                    child: configViewModel,
                },
                {
                    key: "logs",
                    displayName: "Live log",
                    child: logViewModel,
                }
            ]
        },
        BuildResourceGeneralPageGroupEntry(BuildResourceId),
    ],
    formTitle: ids => ids.resourceName,
    type: "multiPage"
};