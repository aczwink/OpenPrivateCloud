/**
 * OpenPrivateCloud
 * Copyright (C) 2019-2024 Amir Czwink (amir130@hotmail.de)
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
import { NextcloudInfoDTO } from "../../../dist/api";

type ResourceAndGroupId = { resourceGroupName: string; resourceName: string };

function BuildResourceId(resourceGroupName: string, resourceName: string)
{
    return "/" + resourceGroupName + "/" + resourceProviders.webServices.name + "/" + resourceProviders.webServices.nextcloudResourceType.name + "/" + resourceName;
}

const overviewViewModel: ObjectViewModel<NextcloudInfoDTO, ResourceAndGroupId> = {
    type: "object",
    actions: [],
    formTitle: _ => "Overview",
    requestObject: (service, ids) => service.resourceProviders._any_.webservices.nextcloud._any_.info.get(ids.resourceGroupName, ids.resourceName),
    schemaName: "NextcloudInfoDTO"
};

export const nextcloudViewModel: MultiPageViewModel<ResourceAndGroupId> = {
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
            ]
        },
        BuildResourceGeneralPageGroupEntry(BuildResourceId),
    ],
    formTitle: ids => ids.resourceName,
    type: "multiPage"
};