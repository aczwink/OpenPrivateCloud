/**
 * OpenPrivateCloud
 * Copyright (C) 2022-2023 Amir Czwink (amir130@hotmail.de)
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
import { AVTranscoderConfig, AVTranscoderInstanceInfo } from "../../../dist/api";
import { MultiPageViewModel, ObjectViewModel } from "../../UI/ViewModel";

type InstanceId = { instanceName: string };

function BuildFullInstanceName(instanceName: string)
{
    return "/" + resourceProviders.multimediaServices.name + "/" + resourceProviders.multimediaServices.avTranscoderResourceType.name + "/" + instanceName;
}

const overviewViewModel: ObjectViewModel<AVTranscoderInstanceInfo, InstanceId> = {
    type: "object",
    actions: [
        {
            type: "activate",
            execute: (service, ids) => service.resourceProviders.multimediaservices.avtranscoder._any_.post(ids.instanceName),
            matIcon: "play_arrow",
            title: "Start transcoding"
        },
    ],
    formTitle: _ => "Overview",
    requestObject: (service, ids) => service.resourceProviders.multimediaservices.avtranscoder._any_.info.get(ids.instanceName),
    schemaName: "AVTranscoderInstanceInfo"
};

const configViewModel: ObjectViewModel<AVTranscoderConfig, InstanceId> = {
    type: "object",
    actions: [
        {
            type: "edit",
            propertiesSchemaName: "AVTranscoderConfig",
            requestObject: (service, ids) => service.resourceProviders.multimediaservices.avtranscoder._any_.config.get(ids.instanceName),
            updateResource: (service, ids, config) => service.resourceProviders.multimediaservices.avtranscoder._any_.config.put(ids.instanceName, config),
        }
    ],
    formTitle: _ => "Configuration",
    requestObject: (service, ids) => service.resourceProviders.multimediaservices.avtranscoder._any_.config.get(ids.instanceName),
    schemaName: "AVTranscoderConfig"
};

export const avTranscoderViewModel: MultiPageViewModel<InstanceId> = {
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
                    child: overviewViewModel,
                },
                {
                    key: "config",
                    displayName: "Config",
                    child: configViewModel
                }
            ]
        }
    ],
    formTitle: ids => ids.instanceName,
    type: "multiPage"
};