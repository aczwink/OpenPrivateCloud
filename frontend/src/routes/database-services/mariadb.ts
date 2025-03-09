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

import { resourceProviders } from "openprivatecloud-common";
import { MySQLDatabaseEntry, MySQLGrant, MySQLUserCreationData, MySQLUserEntry } from "../../../dist/api";
import { RouteSetup } from "acfrontendex";
import { Use } from "acfrontend";
import { APIService } from "../../services/APIService";
import { APISchemaOf } from "../../api-info";
import { BuildCommonResourceActions, BuildResourceGeneralPageGroupEntry } from "../resources-shared/resource-general";

type ResourceAndGroupId = { resourceGroupName: string; resourceName: string };
type ResourceAndGroupIdAndUserId = ResourceAndGroupId & { user: string };

function BuildResourceId(resourceGroupName: string, resourceName: string)
{
    return "/" + resourceGroupName + "/" + resourceProviders.databaseServices.name + "/" + resourceProviders.databaseServices.mariadbResourceType.name + "/" + resourceName;
}

const userViewModel: RouteSetup<ResourceAndGroupIdAndUserId, MySQLUserEntry> = {
    content: {
        type: "object",
        actions: [],
        formTitle: _ => "User",
        requestObject: async ids => {
            const parts = ids.user.split("@");
            return {
                statusCode: 200,
                data: { Host: parts[1], User: parts[0] },
                rawBody: null
            };
        },
        schema: APISchemaOf(x => x.MySQLUserEntry)
    },
    displayText: "User",
    icon: "person",
    routingKey: "user",
};

const createPermissionRoute: RouteSetup<ResourceAndGroupIdAndUserId, MySQLGrant> = {
    content: {
        type: "create",
        call: (ids, data) => {
            const parts = ids.user.split("@");
            return Use(APIService).resourceProviders._any_.databaseservices.mariadb._any_.permissions.post(ids.resourceGroupName, ids.resourceName, {
                hostName: parts[1],
                permission: data,
                userName: parts[0]
            });
        },
        schema: APISchemaOf(x => x.MySQLGrant),
    },
    displayText: "Create permission",
    icon: "plus",
    routingKey: "create"
};

const permissionsViewModel: RouteSetup<ResourceAndGroupIdAndUserId, MySQLGrant> = {
    content: {
        type: "list",
        actions: [
            createPermissionRoute
        ],
        requestObjects: ids => {
            const parts = ids.user.split("@");
            return Use(APIService).resourceProviders._any_.databaseservices.mariadb._any_.permissions.get(ids.resourceGroupName, ids.resourceName, { hostName: parts[1], userName: parts[0] });
        },
        schema: APISchemaOf(x => x.MySQLGrant)
    },
    displayText: "User permissions",
    icon: "lock-fill",
    routingKey: "permissions",
};

const userAndPermissionsViewModel: RouteSetup<ResourceAndGroupIdAndUserId> = {
    content: {
        type: "multiPage",
        actions: [
            {
                type: "delete",
                deleteResource: ids => {
                    const parts = ids.user.split("@");
                    return Use(APIService).resourceProviders._any_.databaseservices.mariadb._any_.users.delete(ids.resourceGroupName, ids.resourceName, { hostName: parts[1], userName: parts[0] });
                }
            }
        ],
        entries: [
            {
                displayName: "",
                entries: [
                    userViewModel,
                    permissionsViewModel
                ]
            }
        ],
        formTitle: ids => "User: " + ids.user
    },
    displayText: "User",
    icon: "person",
    routingKey: "{user}",
};

const createUserRoute: RouteSetup<ResourceAndGroupId, MySQLUserCreationData> = {
    content: {
        type: "create",
        call: (ids, data) => Use(APIService).resourceProviders._any_.databaseservices.mariadb._any_.users.post(ids.resourceGroupName, ids.resourceName, data),
        schema: APISchemaOf(x => x.MySQLUserCreationData),
    },
    displayText: "Create user",
    icon: "plus",
    routingKey: "create",
};

const usersViewModel: RouteSetup<ResourceAndGroupId, MySQLUserEntry> = {
    content: {
        type: "collection",
        actions: [
            createUserRoute
        ],
        child: userAndPermissionsViewModel,
        id: x => x.User + "@" + x.Host,
        requestObjects: ids => Use(APIService).resourceProviders._any_.databaseservices.mariadb._any_.users.get(ids.resourceGroupName, ids.resourceName),
        schema: APISchemaOf(x => x.MySQLUserEntry)
    },
    displayText: "Users",
    icon: "person",
    routingKey: "users",
};

const createDatabaseRoute: RouteSetup<ResourceAndGroupId, MySQLDatabaseEntry> = {
    content: {
        type: "create",
        call: (ids, resource) => Use(APIService).resourceProviders._any_.databaseservices.mariadb._any_.databases.post(ids.resourceGroupName, ids.resourceName, resource),
        schema: APISchemaOf(x => x.MySQLDatabaseEntry),
    },
    displayText: "Create database",
    icon: "plus",
    routingKey: "create",
};

const databasesViewModel: RouteSetup<ResourceAndGroupId, MySQLDatabaseEntry> = {
    content: {
        type: "list",
        actions: [
            createDatabaseRoute
        ],
        boundActions: [
            {
                type: "delete",
                deleteResource: (ids, dbEntry) => {
                    return Use(APIService).resourceProviders._any_.databaseservices.mariadb._any_.databases.delete(ids.resourceGroupName, ids.resourceName, dbEntry);
                }
            }
        ],
        requestObjects: ids => Use(APIService).resourceProviders._any_.databaseservices.mariadb._any_.databases.get(ids.resourceGroupName, ids.resourceName),
        schema: APISchemaOf(x => x.MySQLDatabaseEntry),
    },
    displayText: "Databases",
    icon: "database",
    routingKey: "databases",
};

export const mariadbViewModel: RouteSetup<ResourceAndGroupId> = {
    content: {
        type: "multiPage",
        actions: [
            ...BuildCommonResourceActions(BuildResourceId),
        ],
        entries: [
            {
                displayName: "",
                entries: [
                    usersViewModel,
                    databasesViewModel,
                ]
            },
            BuildResourceGeneralPageGroupEntry(BuildResourceId),
        ],
        formTitle: ids => ids.resourceName,
    },
    displayText: "Maria DB",
    icon: "database",
    routingKey: `${resourceProviders.databaseServices.name}/${resourceProviders.databaseServices.mariadbResourceType.name}/{resourceName}`,
};