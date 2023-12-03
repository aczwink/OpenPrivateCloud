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
import { resourceProviders } from "openprivatecloud-common";
import { MultiPageViewModel, ObjectViewModel } from "../../UI/ViewModel";
import { BuildCommonResourceActions, BuildResourceGeneralPageGroupEntry } from "../shared/resourcegeneral";
import { ADDC_Configuration, ADDC_InfoDTO, ADDC_UserDTO, DockerContainerLogDto } from "../../../dist/api";
import { ListViewModel } from "../../UI/ListViewModel";

type ResourceAndGroupId = { resourceGroupName: string; resourceName: string };

function BuildResourceId(resourceGroupName: string, resourceName: string)
{
    return "/" + resourceGroupName + "/" + resourceProviders.integrationServices.name + "/" + resourceProviders.integrationServices.managedActiveDirectoryResourceType.name + "/" + resourceName;
}

const overviewViewModel: ObjectViewModel<ADDC_InfoDTO, ResourceAndGroupId>  = {
    type: "object",
    actions: [],
    formTitle: _ => "Overview",
    requestObject: (service, ids) => service.resourceProviders._any_.integrationservices.managedad._any_.info.get(ids.resourceGroupName, ids.resourceName),
    schemaName: "ADDC_InfoDTO",
};

const configViewModel: ObjectViewModel<ADDC_Configuration, ResourceAndGroupId> = {
    type: "object",
    actions: [
        {
            type: "edit",
            propertiesSchemaName: "ADDC_Configuration",
            requestObject: (service, ids) => service.resourceProviders._any_.integrationservices.managedad._any_.config.get(ids.resourceGroupName, ids.resourceName),
            updateResource: (service, ids, props) => service.resourceProviders._any_.integrationservices.managedad._any_.config.put(ids.resourceGroupName, ids.resourceName, props),
        }
    ],
    formTitle: _ => "Configuration",
    requestObject: (service, ids) => service.resourceProviders._any_.integrationservices.managedad._any_.config.get(ids.resourceGroupName, ids.resourceName),
    schemaName: "ADDC_Configuration"
};

const usersViewModel: ListViewModel<ADDC_UserDTO, ResourceAndGroupId> = {
    type: "list",
    actions: [],
    boundActions: [],
    displayName: "Users",
    requestObjects: (service, ids) => service.resourceProviders._any_.integrationservices.managedad._any_.users.get(ids.resourceGroupName, ids.resourceName),
    schemaName: "ADDC_UserDTO"
};

const logViewModel: ObjectViewModel<DockerContainerLogDto, ResourceAndGroupId> = {
    actions: [],
    formTitle: _ => "Logs",
    requestObject: async (service, ids) => service.resourceProviders._any_.integrationservices.managedad._any_.log.get(ids.resourceGroupName, ids.resourceName),
    schemaName: "DockerContainerLogDto",
    type: "object"
};

export const addcViewModel: MultiPageViewModel<ResourceAndGroupId> = {
    actions: [
        ...BuildCommonResourceActions(BuildResourceId)
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
                    displayName: "Configuration",
                    child: configViewModel
                },
                {
                    key: "users",
                    displayName: "Users",
                    child: usersViewModel
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
