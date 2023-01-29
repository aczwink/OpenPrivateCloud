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
import { StaticWebsiteInfoDto } from "../../../dist/api";
import { MultiPageViewModel, ObjectViewModel } from "../../UI/ViewModel";
import { UploadStaticWebsiteContentComponent } from "../../Views/static-website/UploadStaticWebsiteContentComponent";

type InstanceId = { instanceName: string };

function BuildFullInstanceName(instanceName: string)
{
    return "/" + resourceProviders.webServices.name + "/" + resourceProviders.webServices.staticWebsiteResourceType.name + "/" + instanceName;
}

const overviewViewModel: ObjectViewModel<StaticWebsiteInfoDto, InstanceId> = {
    type: "object",
    actions: [],
    formTitle: _ => "Overview",
    requestObject: (service, ids) => service.resourceProviders.webservices.staticwebsite._any_.info.get(ids.instanceName),
    schemaName: "StaticWebsiteInfoDto"
};

export const staticWebsiteViewModel: MultiPageViewModel<InstanceId> = {
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
                    key: "content",
                    displayName: "Content",
                    child: {
                        type: "component",
                        component: UploadStaticWebsiteContentComponent
                    }
                }
            ]
        }
    ],
    formTitle: ids => ids.instanceName,
    type: "multiPage"
};