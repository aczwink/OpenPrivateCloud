/**
 * OpenPrivateCloud
 * Copyright (C) 2019-2022 Amir Czwink (amir130@hotmail.de)
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
import { NodeAppServiceInfoDto, NodeAppServiceStatus } from "../../../dist/api";
import { PageNotFoundComponent } from "../../PageNotFoundComponent";
import { MultiPageViewModel, ObjectViewModel } from "../../UI/ViewModel";
import { UploadNodeAppServieContentComponent } from "../../Views/node-app-service/UploadNodeAppServieContentComponent";

type InstanceId = { instanceName: string };

function BuildFullInstanceName(instanceName: string)
{
    return "/" + resourceProviders.webServices.name + "/" + resourceProviders.webServices.nodeAppServiceResourceType.name + "/" + instanceName;
}

const overviewViewModel: ObjectViewModel<NodeAppServiceInfoDto, InstanceId> = {
    type: "object",
    actions: [
        {
            type: "activate",
            execute: (service, ids) => service.resourceProviders.webservices.nodeappservice._any_.startStop.post(ids.instanceName, { action: "start" }),
            matIcon: "play_arrow",
            title: "Start"
        },
        {
            type: "activate",
            execute: (service, ids) => service.resourceProviders.webservices.nodeappservice._any_.startStop.post(ids.instanceName, { action: "stop" }),
            matIcon: "power_settings_new",
            title: "Stop"
        },
    ],
    formTitle: _ => "Overview",
    requestObject: (service, ids) => service.resourceProviders.webservices.nodeappservice._any_.info.get(ids.instanceName),
    schemaName: "NodeAppServiceInfoDto"
};

const statusViewModel: ObjectViewModel<NodeAppServiceStatus, InstanceId> = {
    type: "object",
    actions: [],
    formTitle: _ => "Status",
    requestObject: (service, ids) => service.resourceProviders.webservices.nodeappservice._any_.status.get(ids.instanceName),
    schemaName: "NodeAppServiceStatus"
};

export const nodeAppServiceViewodel: MultiPageViewModel<InstanceId> = {
    actions: [
        {
            type: "delete",
            deleteResource: (service, ids) => service.instances.delete({ fullInstanceName: BuildFullInstanceName(ids.instanceName) })
        }
    ],
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
            key: "content",
            displayName: "Content",
            child: {
                type: "component",
                component: UploadNodeAppServieContentComponent
            }
        }
    ],
    formTitle: ids => ids.instanceName,
    type: "multiPage"
};