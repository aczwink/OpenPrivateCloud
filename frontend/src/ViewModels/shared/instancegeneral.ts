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

type InstanceId = { instanceName: string };

function BuildHealthViewModel(buildFullInstanceName: (instanceName: string) => string)
{
    const accessControlViewModel: ObjectViewModel<InstanceHealthData, InstanceId> = {
        type: "object",
        actions: [],
        formTitle: _ => "Instance health",
        requestObject: (service, ids) => service.health.instance.get({ fullInstanceName: buildFullInstanceName(ids.instanceName) }),
        schemaName: "InstanceHealthData"
    };

    return accessControlViewModel;
}

export function BuildInstanceGeneralPageGroupEntry(buildFullInstanceName: (instanceName: string) => string)
{
    return {
        displayName: "",
        entries: [
            BuildAccessControlPageEntry(buildFullInstanceName),
            {
                child: BuildHealthViewModel(buildFullInstanceName),
                displayName: "Health",
                key: "health"
            },
        ]
    };
}