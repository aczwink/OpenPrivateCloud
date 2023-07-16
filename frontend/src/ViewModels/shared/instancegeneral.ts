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

import { InstanceHealthData } from "../../../dist/api";
import { ObjectViewModel } from "../../UI/ViewModel";
import { BuildAccessControlPageEntry } from "./accesscontrol";

type ResourceAndGroupId = { resourceGroupName: string; resourceName: string };

function BuildHealthViewModel(buildResourceId: (resourceGroupName: string, resourceName: string) => string)
{
    const healthViewModel: ObjectViewModel<InstanceHealthData, ResourceAndGroupId> = {
        type: "object",
        actions: [],
        formTitle: _ => "Instance health",
        requestObject: (service, ids) => service.health.instance.get({ id: buildResourceId(ids.resourceGroupName, ids.resourceName) }),
        schemaName: "InstanceHealthData"
    };

    return healthViewModel;
}

export function BuildInstanceGeneralPageGroupEntry(buildResourceId: (resourceGroupName: string, resourceName: string) => string)
{
    return {
        displayName: "",
        entries: [
            BuildAccessControlPageEntry(buildResourceId),
            {
                child: BuildHealthViewModel(buildResourceId),
                displayName: "Health",
                key: "health"
            },
        ]
    };
}