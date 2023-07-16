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
import { StaticWebsiteConfig, StaticWebsiteInfoDto } from "../../../dist/api";
import { MultiPageViewModel, ObjectViewModel } from "../../UI/ViewModel";
import { UploadStaticWebsiteContentComponent } from "../../Views/static-website/UploadStaticWebsiteContentComponent";

type ResourceAndGroupId = { resourceGroupName: string; resourceName: string };

function BuildResourceId(resourceGroupName: string, resourceName: string)
{
    return "/" + resourceGroupName + "/" + resourceProviders.webServices.name + "/" + resourceProviders.webServices.staticWebsiteResourceType.name + "/" + resourceName;
}

const overviewViewModel: ObjectViewModel<StaticWebsiteInfoDto, ResourceAndGroupId> = {
    type: "object",
    actions: [],
    formTitle: _ => "Overview",
    requestObject: (service, ids) => service.resourceProviders._any_.webservices.staticwebsite._any_.info.get(ids.resourceGroupName, ids.resourceName),
    schemaName: "StaticWebsiteInfoDto"
};

const configViewModel: ObjectViewModel<StaticWebsiteConfig, ResourceAndGroupId> = {
    type: "object",
    actions: [
        {
            type: "edit",
            propertiesSchemaName: "StaticWebsiteConfig",
            requestObject: (service, ids) => service.resourceProviders._any_.webservices.staticwebsite._any_.config.get(ids.resourceGroupName, ids.resourceName),
            updateResource: (service, ids, config) => service.resourceProviders._any_.webservices.staticwebsite._any_.config.put(ids.resourceGroupName, ids.resourceName, config),
        }
    ],
    formTitle: _ => "Config",
    requestObject: (service, ids) => service.resourceProviders._any_.webservices.staticwebsite._any_.config.get(ids.resourceGroupName, ids.resourceName),
    schemaName: "StaticWebsiteConfig"
};

export const staticWebsiteViewModel: MultiPageViewModel<ResourceAndGroupId> = {
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
                    child: overviewViewModel
                },
                {
                    key: "config",
                    displayName: "Config",
                    child: configViewModel
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
    formTitle: ids => ids.resourceName,
    type: "multiPage"
};