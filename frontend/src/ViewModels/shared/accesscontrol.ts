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

import { RoleAssignment } from "../../../dist/api";
import { ListViewModel } from "../../UI/ListViewModel";

type ResourceAndGroupId = { resourceGroupName: string; resourceName: string };

function BuildAccessControlViewModel(buildResourceId: (resourceGroupName: string, resourceName: string) => string)
{
    const accessControlViewModel: ListViewModel<RoleAssignment, ResourceAndGroupId> = {
        actions: [
            {
                type: "create",
                createResource: (service, ids, roleAssignment) => service.roleAssignments.instance.post({ resourceId: buildResourceId(ids.resourceGroupName, ids.resourceName) }, roleAssignment)
            }
        ],
        boundActions: [
            {
                type: "delete",
                deleteResource: (service, ids, roleAssignment) => service.roleAssignments.instance.delete({ resourceId: buildResourceId(ids.resourceGroupName, ids.resourceName) }, roleAssignment)
            }
        ],
        displayName: "Access control",
        requestObjects: (service, ids) => service.roleAssignments.instance.get({ resourceId: buildResourceId(ids.resourceGroupName, ids.resourceName) }),
        schemaName: "RoleAssignment",
        type: "list",
    };

    return accessControlViewModel;
}

export function BuildAccessControlPageEntry(buildResourceId: (resourceGroupName: string, resourceName: string) => string)
{
    return {
        child: BuildAccessControlViewModel(buildResourceId),
        displayName: "Access control",
        key: "access"
    };
}