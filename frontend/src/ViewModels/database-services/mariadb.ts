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

type InstanceId = { instanceName: string };
type InstanceAndUserId = InstanceId & { user: string };

function BuildFullInstanceName(instanceName: string)
{
    return "/" + resourceProviders.databaseServices.name + "/" + resourceProviders.databaseServices.mariadbResourceType.name + "/" + instanceName;
}

const permissionsViewModel: ListViewModel<MySQLGrant, InstanceAndUserId> = {
    type: "list",
    actions: [
        {
            type: "create",
            createResource: (service, ids, data) => {
                const parts = ids.user.split("@");
                return service.resourceProviders.databaseservices.mariadb._any_.permissions.post(ids.instanceName, {
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
        return service.resourceProviders.databaseservices.mariadb._any_.permissions.get(ids.instanceName, { hostName: parts[1], userName: parts[0] });
    },
    schemaName: "MySQLGrant"
};

const userViewModel: ObjectViewModel<MySQLUserEntry, InstanceAndUserId> = {
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

const userAndPermissionsViewModel: MultiPageViewModel<InstanceAndUserId> = {
    type: "multiPage",
    actions: [
        {
            type: "delete",
            deleteResource: (service, ids) => {
                const parts = ids.user.split("@");
                return service.resourceProviders.databaseservices.mariadb._any_.users.delete(ids.instanceName, { hostName: parts[1], userName: parts[0] });
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

const usersViewModel: CollectionViewModel<MySQLUserEntry, InstanceId, MySQLUserCreationData> = {
    type: "collection",
    actions: [
        {
            type: "create",
            createResource: (service, ids, data) => service.resourceProviders.databaseservices.mariadb._any_.users.post(ids.instanceName, data),
            schemaName: "MySQLUserCreationData"
        },
    ],
    child: userAndPermissionsViewModel,
    displayName: "Users",
    extractId: x => x.User + "@" + x.Host,
    idKey: "user",
    requestObjects: (service, ids) => service.resourceProviders.databaseservices.mariadb._any_.users.get(ids.instanceName),
    schemaName: "MySQLUserEntry"
};

const databasesViewModel: ListViewModel<MySQLDatabaseEntry, InstanceId> = {
    type: "list",
    actions: [
        {
            type: "create",
            createResource: (service, ids, resource) => service.resourceProviders.databaseservices.mariadb._any_.databases.post(ids.instanceName, resource),
        }
    ],
    boundActions: [],
    displayName: "Databases",
    requestObjects: (service, ids) => service.resourceProviders.databaseservices.mariadb._any_.databases.get(ids.instanceName),
    schemaName: "MySQLDatabaseEntry"
};

export const mariadbViewModel: MultiPageViewModel<InstanceId> = {
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
        BuildInstanceGeneralPageGroupEntry(BuildFullInstanceName),
    ],
    formTitle: ids => ids.instanceName,
    type: "multiPage"
};