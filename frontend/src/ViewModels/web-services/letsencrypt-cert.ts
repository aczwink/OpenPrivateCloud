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
import { LetsEncryptCertInfoDto } from "../../../dist/api";
import { MultiPageViewModel, ObjectViewModel } from "../../UI/ViewModel";
import { BuildInstanceGeneralPageGroupEntry } from "../shared/instancegeneral";

type ResourceAndGroupId = { resourceGroupName: string; resourceName: string };

function BuildFullInstanceName(instanceName: string)
{
    return "/" + resourceProviders.webServices.name + "/" + resourceProviders.webServices.letsencryptCertResourceType.name + "/" + instanceName;
}

const overviewViewModel: ObjectViewModel<LetsEncryptCertInfoDto, ResourceAndGroupId> = {
    type: "object",
    actions: [],
    formTitle: _ => "Overview",
    requestObject: (service, ids) => service.resourceProviders._any_.webservices.letsencryptcert._any_.info.get(ids.resourceGroupName, ids.resourceName),
    schemaName: "LetsEncryptCertInfoDto"
};

export const letsEncryptViewModel: MultiPageViewModel<ResourceAndGroupId> = {
    actions: [],
    entries: [
        {
            displayName: "",
            entries: [
                {
                    key: "overview",
                    displayName: "Overview",
                    child: overviewViewModel,
                }
            ]
        },
        BuildInstanceGeneralPageGroupEntry(BuildFullInstanceName),
    ],
    formTitle: ids => ids.resourceName,
    type: "multiPage"
};