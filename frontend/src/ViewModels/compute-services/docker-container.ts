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
import { DockerContainerConfig, DockerContainerInfo, DockerContainerLogDto } from "../../../dist/api";
import { ExtractDataFromResponseOrShowErrorMessageOnError } from "../../UI/ResponseHandler";
import { MultiPageViewModel, ObjectViewModel } from "../../UI/ViewModel";

type InstanceId = { instanceName: string };

function BuildFullInstanceName(instanceName: string)
{
    return "/" + resourceProviders.computeServices.name + "/" + resourceProviders.computeServices.dockerContainerResourceType.name + "/" + instanceName;
}

const overviewViewModel: ObjectViewModel<DockerContainerInfo, InstanceId>  = {
    type: "object",
    actions: [
        {
            type: "activate",
            execute: (service, ids) => service.resourceProviders.computeservices.dockercontainer._any_.post(ids.instanceName, { action: "start"}),
            matIcon: "play_arrow",
            title: "Start"
        },
        {
            type: "activate",
            execute: (service, ids) => service.resourceProviders.computeservices.dockercontainer._any_.post(ids.instanceName, { action: "shutdown"}),
            matIcon: "power_settings_new",
            title: "Shutdown"
        }
    ],
    formTitle: _ => "Overview",
    requestObject: (service, ids) => service.resourceProviders.computeservices.dockercontainer._any_.info.get(ids.instanceName),
    schemaName: "DockerContainerInfo",
};

const configViewModel: ObjectViewModel<DockerContainerConfig, InstanceId> = {
    actions: [
        {
            type: "edit",
            propertiesSchemaName: "DockerContainerConfig",
            loadContext: async (service, ids) => {
                const response = await service.resourceProviders.computeservices.dockercontainer._any_.info.get(ids.instanceName);
                const result = ExtractDataFromResponseOrShowErrorMessageOnError(response);
                if(result.ok)
                    return result.value;
                return {
                    hostName: ""
                };
            },
            requestObject: async (service, ids) => service.resourceProviders.computeservices.dockercontainer._any_.config.get(ids.instanceName),
            updateResource: (service, ids, newValue) => service.resourceProviders.computeservices.dockercontainer._any_.config.put(ids.instanceName, newValue)
        }
    ],
    formTitle: _ => "Container configuration",
    requestObject: async (service, ids) => service.resourceProviders.computeservices.dockercontainer._any_.config.get(ids.instanceName),
    schemaName: "DockerContainerConfig",
    type: "object"
};

const logViewModel: ObjectViewModel<DockerContainerLogDto, InstanceId> = {
    actions: [],
    formTitle: _ => "Container log",
    requestObject: async (service, ids) => service.resourceProviders.computeservices.dockercontainer._any_.log.get(ids.instanceName),
    schemaName: "DockerContainerLogDto",
    type: "object"
};

export const dockerContainerViewModel: MultiPageViewModel<InstanceId> = {
    actions: [
        {
            type: "delete",
            deleteResource: (service, ids) => service.instances.delete({ fullInstanceName: BuildFullInstanceName(ids.instanceName) })
        }
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
        }
    ],
    formTitle: ids => ids.instanceName,
    type: "multiPage"
};