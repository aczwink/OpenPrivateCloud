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
import { MySQLDatabaseEntry, MySQLGrant, MySQLUserCreationData, MySQLUserEntry } from "../../../dist/api";
import { PageNotFoundComponent } from "../../PageNotFoundComponent";
import { ListViewModel } from "../../UI/ListViewModel";
import { CollectionViewModel, MultiPageViewModel, ObjectViewModel } from "../../UI/ViewModel";
import { BuildInstanceGeneralPageGroupEntry } from "../shared/instancegeneral";

type ResourceAndGroupId = { resourceGroupName: string; resourceName: string };
type ResourceAndGroupIdAndUserId = ResourceAndGroupId & { user: string };

function BuildResourceId(resourceGroupName: string, resourceName: string)
{
    return "/" + resourceGroupName + "/" + resourceProviders.databaseServices.name + "/" + resourceProviders.databaseServices.mariadbResourceType.name + "/" + resourceName;
}

const permissionsViewModel: ListViewModel<MySQLGrant, ResourceAndGroupIdAndUserId> = {
    type: "list",
    actions: [
        {
            type: "create",
            createResource: (service, ids, data) => {
                const parts = ids.user.split("@");
                return service.resourceProviders._any_.databaseservices.mariadb._any_.permissions.post(ids.resourceGroupName, ids.resourceName, {
                    hostName: parts[1],
                    permission: data,
                    userName: parts[0]
                });
            },
        }
    ],
    boundActions: [],
    displayName: "User permissions",
    requestObjects: (service, ids) => {
        const parts = ids.user.split("@");
        return service.resourceProviders._any_.databaseservices.mariadb._any_.permissions.get(ids.resourceGroupName, ids.resourceName, { hostName: parts[1], userName: parts[0] });
    },
    schemaName: "MySQLGrant"
};

const userViewModel: ObjectViewModel<MySQLUserEntry, ResourceAndGroupIdAndUserId> = {
    type: "object",
    actions: [],
    formTitle: _ => "User",
    requestObject: async (service, ids) => {
        const parts = ids.user.split("@");
        return {
            statusCode: 200,
            data: { Host: parts[1], User: parts[0] },
            rawBody: null
        };
    },
    schemaName: "MySQLUserEntry"
};

const userAndPermissionsViewModel: MultiPageViewModel<ResourceAndGroupIdAndUserId> = {
    type: "multiPage",
    actions: [
        {
            type: "delete",
            deleteResource: (service, ids) => {
                const parts = ids.user.split("@");
                return service.resourceProviders._any_.databaseservices.mariadb._any_.users.delete(ids.resourceGroupName, ids.resourceName, { hostName: parts[1], userName: parts[0] });
            }
        }
    ],
    entries: [
        {
            displayName: "",
            entries: [
                {
                    key: "user",
                    child: userViewModel,
                    displayName: "User"
                },
                {
                    key: "permissions",
                    child: permissionsViewModel,
                    displayName: "Permissions"
                }
            ]
        }
    ],
    formTitle: ids => "User: " + ids.user
};

const usersViewModel: CollectionViewModel<MySQLUserEntry, ResourceAndGroupId, MySQLUserCreationData> = {
    type: "collection",
    actions: [
        {
            type: "create",
            createResource: (service, ids, data) => service.resourceProviders._any_.databaseservices.mariadb._any_.users.post(ids.resourceGroupName, ids.resourceName, data),
            schemaName: "MySQLUserCreationData"
        },
    ],
    child: userAndPermissionsViewModel,
    displayName: "Users",
    extractId: x => x.User + "@" + x.Host,
    idKey: "user",
    requestObjects: (service, ids) => service.resourceProviders._any_.databaseservices.mariadb._any_.users.get(ids.resourceGroupName, ids.resourceName),
    schemaName: "MySQLUserEntry"
};

const databasesViewModel: ListViewModel<MySQLDatabaseEntry, ResourceAndGroupId> = {
    type: "list",
    actions: [
        {
            type: "create",
            createResource: (service, ids, resource) => service.resourceProviders._any_.databaseservices.mariadb._any_.databases.post(ids.resourceGroupName, ids.resourceName, resource),
        }
    ],
    boundActions: [],
    displayName: "Databases",
    requestObjects: (service, ids) => service.resourceProviders._any_.databaseservices.mariadb._any_.databases.get(ids.resourceGroupName, ids.resourceName),
    schemaName: "MySQLDatabaseEntry"
};

export const mariadbViewModel: MultiPageViewModel<ResourceAndGroupId> = {
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
                    child: {
                        type: "component",
                        component: PageNotFoundComponent
                    },
                    icon: {
                        name: "storage",
                        type: "material"
                    }
                },
                {
                    key: "users",
                    displayName: "Users",
                    child: usersViewModel
                },
                {
                    key: "databases",
                    displayName: "Databases",
                    child: databasesViewModel
                }
            ]
        },
        BuildInstanceGeneralPageGroupEntry(BuildResourceId),
    ],
    formTitle: ids => ids.resourceName,
    type: "multiPage"
};