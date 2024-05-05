/**
 * OpenPrivateCloud
 * Copyright (C) 2023-2024 Amir Czwink (amir130@hotmail.de)
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
import { LetsEncryptCertInfoDTO, LetsEncryptConfigDTO, LetsEncryptLogsDTO } from "../../../dist/api";

type ResourceAndGroupId = { resourceGroupName: string; resourceName: string };

function BuildResourceId(resourceGroupName: string, resourceName: string)
{
    return "/" + resourceGroupName + "/" + resourceProviders.webServices.name + "/" + resourceProviders.webServices.letsencryptCertResourceType.name + "/" + resourceName;
}

const overviewViewModel: ObjectViewModel<LetsEncryptCertInfoDTO, ResourceAndGroupId> = {
    type: "object",
    actions: [],
    formTitle: _ => "Overview",
    requestObject: (service, ids) => service.resourceProviders._any_.webservices.letsencryptcert._any_.info.get(ids.resourceGroupName, ids.resourceName),
    schemaName: "LetsEncryptCertInfoDTO"
};

const logsViewModel: ObjectViewModel<LetsEncryptLogsDTO, ResourceAndGroupId> = {
    type: "object",
    actions: [],
    formTitle: _ => "Logs",
    requestObject: (service, ids) => service.resourceProviders._any_.webservices.letsencryptcert._any_.logs.get(ids.resourceGroupName, ids.resourceName),
    schemaName: "LetsEncryptLogsDTO"
};

const configViewModel: ObjectViewModel<LetsEncryptConfigDTO, ResourceAndGroupId> = {
    type: "object",
    actions: [
        {
            type: "edit",
            propertiesSchemaName: "LetsEncryptConfigDTO",
            requestObject: (service, ids) => service.resourceProviders._any_.webservices.letsencryptcert._any_.config.get(ids.resourceGroupName, ids.resourceName),
            updateResource: (service, ids, newProps) => service.resourceProviders._any_.webservices.letsencryptcert._any_.config.put(ids.resourceGroupName, ids.resourceName, newProps),
        }
    ],
    formTitle: _ => "Config",
    requestObject: (service, ids) => service.resourceProviders._any_.webservices.letsencryptcert._any_.config.get(ids.resourceGroupName, ids.resourceName),
    schemaName: "LetsEncryptConfigDTO"
};

export const letsEncryptViewModel: MultiPageViewModel<ResourceAndGroupId> = {
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
                    child: overviewViewModel,
                },
                {
                    child: logsViewModel,
                    displayName: "Logs",
                    key: "logs",
                },
                {
                    child: configViewModel,
                    displayName: "Config",
                    key: "config",
                }
            ]
        },
        BuildResourceGeneralPageGroupEntry(BuildResourceId),
    ],
    formTitle: ids => ids.resourceName,
    type: "multiPage"
};