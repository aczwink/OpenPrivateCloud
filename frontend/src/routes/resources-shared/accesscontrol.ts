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

import { RouteSetup } from "acfrontendex";
import { RoleAssignment } from "../../../dist/api";
import { Use } from "acfrontend";
import { APIService } from "../../services/APIService";
import { APISchemaOf } from "../../api-info";

type ResourceAndGroupId = { resourceGroupName: string; resourceName: string };

export function BuildAccessControlViewModel(buildResourceId: (resourceGroupName: string, resourceName: string) => string)
{
    const createRouteSetup: RouteSetup<ResourceAndGroupId, RoleAssignment> = {
        content: {
            type: "create",
            call: (ids, roleAssignment) => Use(APIService).roleAssignments.instance.post({ resourceId: buildResourceId(ids.resourceGroupName, ids.resourceName) }, roleAssignment),
            schema: APISchemaOf(x => x.RoleAssignment),
        },
        displayText: "Create role assignment",
        icon: "plus",
        routingKey: "create",
    };
    const accessControlViewModel: RouteSetup<ResourceAndGroupId, RoleAssignment> = {
        content: {
            type: "list",
            actions: [
                createRouteSetup
            ],
            boundActions: [
                {
                    type: "delete",
                    deleteResource: (ids, roleAssignment) => Use(APIService).roleAssignments.instance.delete({ resourceId: buildResourceId(ids.resourceGroupName, ids.resourceName) }, roleAssignment)
                }
            ],
            requestObjects: ids => Use(APIService).roleAssignments.instance.get({ resourceId: buildResourceId(ids.resourceGroupName, ids.resourceName) }),
            schema: APISchemaOf(x => x.RoleAssignment)
        },
        displayText: "Access control",
        icon: "lock-fill",
        routingKey: "access",
    };

    return accessControlViewModel;
}