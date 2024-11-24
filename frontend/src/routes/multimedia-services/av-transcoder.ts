/**
 * OpenPrivateCloud
 * Copyright (C) 2022-2024 Amir Czwink (amir130@hotmail.de)
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
import { APIResponseHandler, RouteSetup } from "acfrontendex";
import { BuildCommonResourceActions, BuildResourceGeneralPageGroupEntry } from "../resources-shared/resource-general";
import { Use } from "acfrontend";
import { APIService } from "../../services/APIService";
import { OpenAPISchema } from "../../api-info";

type ResourceAndGroupId = { resourceGroupName: string; resourceName: string };

function BuildResourceId(resourceGroupName: string, resourceName: string)
{
    return "/" + resourceGroupName + "/" + resourceProviders.multimediaServices.name + "/" + resourceProviders.multimediaServices.avTranscoderResourceType.name + "/" + resourceName;
}

const overviewViewModel: RouteSetup<ResourceAndGroupId, AVTranscoderInstanceInfo> = {
    content: {
        type: "object",
        actions: [
            {
                type: "activate",
                execute: ids => Use(APIService).resourceProviders._any_.multimediaservices.avtranscoder._any_.post(ids.resourceGroupName, ids.resourceName),
                icon: "play",
                title: "Start transcoding"
            },
        ],
        formTitle: _ => "Overview",
        requestObject: ids => Use(APIService).resourceProviders._any_.multimediaservices.avtranscoder._any_.info.get(ids.resourceGroupName, ids.resourceName),
        schema: OpenAPISchema("AVTranscoderInstanceInfo"),
    },
    displayText: "Overview",
    icon: "binoculars",
    routingKey: "overview",
};

const configViewModel: RouteSetup<ResourceAndGroupId, AVTranscoderConfig> = {
    content: {
        type: "object",
        actions: [
            {
                type: "edit",
                requestObject: ids => Use(APIService).resourceProviders._any_.multimediaservices.avtranscoder._any_.config.get(ids.resourceGroupName, ids.resourceName),
                schema: OpenAPISchema("AVTranscoderConfig"),
                updateResource: (ids, config) => Use(APIService).resourceProviders._any_.multimediaservices.avtranscoder._any_.config.put(ids.resourceGroupName, ids.resourceName, config),
                loadContext: async ids => {
                    const response = await Use(APIService).health.resource.get({ id: BuildResourceId(ids.resourceGroupName, ids.resourceName) });
                    const result = await Use(APIResponseHandler).ExtractDataFromResponseOrShowErrorMessageOnError(response);
                    if(result.ok)
                    {
                        return {
                            hostName: result.value.hostName
                        };
                    }
                    return {
                        hostName: ""
                    };
                },
            }
        ],
        formTitle: _ => "Configuration",
        requestObject: ids => Use(APIService).resourceProviders._any_.multimediaservices.avtranscoder._any_.config.get(ids.resourceGroupName, ids.resourceName),
        schema: OpenAPISchema("AVTranscoderConfig"),
    },
    displayText: "Config",
    icon: "sliders",
    routingKey: "config",
};

export const avTranscoderViewModel: RouteSetup<ResourceAndGroupId> = {
    content: {
        type: "multiPage",
        actions: [
            ...BuildCommonResourceActions(BuildResourceId)
        ],
        entries: [
            {
                displayName: "",
                entries: [
                    overviewViewModel,
                    configViewModel
                ]
            },
            BuildResourceGeneralPageGroupEntry(BuildResourceId),
        ],
        formTitle: ids => ids.resourceName,
    },
    displayText: "AV Transcoder",
    icon: "film",
    routingKey: `${resourceProviders.multimediaServices.name}/${resourceProviders.multimediaServices.avTranscoderResourceType.name}/{resourceName}`
};