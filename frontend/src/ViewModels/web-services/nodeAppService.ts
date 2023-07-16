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
import { NodeAppConfig, NodeAppServiceInfoDto, NodeAppServiceStatus } from "../../../dist/api";
import { MultiPageViewModel, ObjectViewModel } from "../../UI/ViewModel";
import { UploadNodeAppServieContentComponent } from "../../Views/node-app-service/UploadNodeAppServieContentComponent";

type ResourceAndGroupId = { resourceGroupName: string; resourceName: string };

function BuildResourceId(resourceGroupName: string, resourceName: string)
{
    return "/" + resourceGroupName + "/" + resourceProviders.webServices.name + "/" + resourceProviders.webServices.nodeAppServiceResourceType.name + "/" + resourceName;
}

const overviewViewModel: ObjectViewModel<NodeAppServiceInfoDto, ResourceAndGroupId> = {
    type: "object",
    actions: [
        {
            type: "activate",
            execute: (service, ids) => service.resourceProviders._any_.webservices.nodeappservice._any_.startStop.post(ids.resourceGroupName, ids.resourceName, { action: "start" }),
            matIcon: "play_arrow",
            title: "Start"
        },
        {
            type: "activate",
            execute: (service, ids) => service.resourceProviders._any_.webservices.nodeappservice._any_.startStop.post(ids.resourceGroupName, ids.resourceName, { action: "stop" }),
            matIcon: "power_settings_new",
            title: "Stop"
        },
    ],
    formTitle: _ => "Overview",
    requestObject: (service, ids) => service.resourceProviders._any_.webservices.nodeappservice._any_.info.get(ids.resourceGroupName, ids.resourceName),
    schemaName: "NodeAppServiceInfoDto"
};

const statusViewModel: ObjectViewModel<NodeAppServiceStatus, ResourceAndGroupId> = {
    type: "object",
    actions: [],
    formTitle: _ => "Status",
    requestObject: (service, ids) => service.resourceProviders._any_.webservices.nodeappservice._any_.status.get(ids.resourceGroupName, ids.resourceName),
    schemaName: "NodeAppServiceStatus"
};

const configViewModel: ObjectViewModel<NodeAppConfig, ResourceAndGroupId> = {
    actions: [
        {
            type: "edit",
            propertiesSchemaName: "NodeAppConfig",
            requestObject: async (service, ids) => service.resourceProviders._any_.webservices.nodeappservice._any_.config.get(ids.resourceGroupName, ids.resourceName),
            updateResource: (service, ids, newValue) => service.resourceProviders._any_.webservices.nodeappservice._any_.config.put(ids.resourceGroupName, ids.resourceName, newValue)
        }
    ],
    formTitle: _ => "Configuration",
    requestObject: async (service, ids) => service.resourceProviders._any_.webservices.nodeappservice._any_.config.get(ids.resourceGroupName, ids.resourceName),
    schemaName: "NodeAppConfig",
    type: "object"
};

export const nodeAppServiceViewodel: MultiPageViewModel<ResourceAndGroupId> = {
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
                    key: "status",
                    displayName: "Status",
                    child: statusViewModel
                },
                {
                    key: "config",
                    displayName: "Config",
                    child: configViewModel,
                },
                {
                    key: "content",
                    displayName: "Content",
                    child: {
                        type: "component",
                        component: UploadNodeAppServieContentComponent
                    }
                }
            ]
        }
    ],
    formTitle: ids => ids.resourceName,
    type: "multiPage"
};