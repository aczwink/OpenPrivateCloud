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
import { BackupVaultControllerDatabaseConfig, BackupVaultDatabaseConfig, BackupVaultDeploymentDataDto, BackupVaultFileStorageConfig, BackupVaultKeyVaultSourceDTO, BackupVaultRetentionConfig, BackupVaultTargetConfigDTO, BackupVaultTrigger, InstanceLog, ResourceLogOverviewData } from "../../../dist/api";
import { APIResponseHandler, RouteSetup } from "acfrontendex";
import { BuildCommonResourceActions, BuildResourceGeneralPageGroupEntry } from "../resources-shared/resource-general";
import { APIMap, OpenAPISchema } from "../../api-info";
import { Use } from "acfrontend";
import { APIService } from "../../services/APIService";

type ResourceAndGroupId = { resourceGroupName: string; resourceName: string };

function BuildResourceId(resourceGroupName: string, resourceName: string)
{
    return "/" + resourceGroupName + "/" + resourceProviders.backupServices.name + "/" + resourceProviders.backupServices.backupVaultResourceType.name + "/" + resourceName;
}

const overviewViewModel: RouteSetup<ResourceAndGroupId, BackupVaultDeploymentDataDto> = {
    content: {
        type: "object",
        actions: [
            {
                type: "activate",
                execute: ids => Use(APIService).resourceProviders._any_.backupservices.backupvault._any_.post(ids.resourceGroupName, ids.resourceName),
                icon: "play",
                title: "Start backup"
            }
        ],
        formTitle: _ => "Overview",
        requestObject: ids => Use(APIService).resourceProviders._any_.backupservices.backupvault._any_.deploymentdata.get(ids.resourceGroupName, ids.resourceName),
        schema: OpenAPISchema("BackupVaultDeploymentDataDto")
    },
    displayText: "Overview",
    icon: "binoculars",
    routingKey: "overview",
};

const logViewModel: RouteSetup<ResourceAndGroupId & { logId: number}, InstanceLog> = {
    content: {
        type: "object",
        actions: [],
        formTitle: _ => "Log",
        requestObject: ids => Use(APIService).resources.logs._any_.get(ids.logId),
        schema: OpenAPISchema("InstanceLog")
    },
    displayText: "Log entry",
    icon: "journal",
    routingKey: "{logId}",
};

const logsViewModel: RouteSetup<ResourceAndGroupId, ResourceLogOverviewData> = {
    content: {
        type: "collection",
        child: logViewModel,
        id: "logId",
        requestObjects: ids => Use(APIService).resources.logs.get({ resourceId: BuildResourceId(ids.resourceGroupName, ids.resourceName) }),
        schema: OpenAPISchema("ResourceLogOverviewData"),
    },
    displayText: "Logs",
    icon: "journal",
    routingKey: "logs",
};

const targetConfigViewModel: RouteSetup<ResourceAndGroupId, BackupVaultTargetConfigDTO> = {
    content: {
        type: "object",
        actions: [
            {
                type: "edit",
                requestObject: ids => Use(APIService).resourceProviders._any_.backupservices.backupvault._any_.target.get(ids.resourceGroupName, ids.resourceName),
                schema: OpenAPISchema("BackupVaultTargetConfigDTO"),
                updateResource: (ids, newValue) => Use(APIService).resourceProviders._any_.backupservices.backupvault._any_.target.put(ids.resourceGroupName, ids.resourceName, newValue)
            }
        ],
        formTitle: _ => "Backup target configuration",
        requestObject: ids => Use(APIService).resourceProviders._any_.backupservices.backupvault._any_.target.get(ids.resourceGroupName, ids.resourceName),
        schema: OpenAPISchema("BackupVaultTargetConfigDTO"),
    },
    displayText: "Target config",
    icon: "bullseye",
    routingKey: "target",
};

const addFileStorageSourceRoute: RouteSetup<ResourceAndGroupId, BackupVaultFileStorageConfig> = {
    content: {
        type: "create",
        call: (ids, newValue) => Use(APIService).resourceProviders._any_.backupservices.backupvault._any_.sources.post(ids.resourceGroupName, ids.resourceName, newValue),
        loadContext: async ids => {
            const response = await Use(APIService).resourceProviders._any_.backupservices.backupvault._any_.deploymentdata.get(ids.resourceGroupName, ids.resourceName);
            const result = await Use(APIResponseHandler).ExtractDataFromResponseOrShowErrorMessageOnError(response);
            if(result.ok === false)
                throw new Error("TODO");
            return result.value;
        },
        schema: OpenAPISchema("BackupVaultFileStorageConfig")
    },
    displayText: "Add file storage source",
    icon: "plus",
    routingKey: "add",
};

const fileStorageSourcesViewModel: RouteSetup<ResourceAndGroupId, BackupVaultFileStorageConfig> = {
    content: {
        type: "list",
        actions: [
            addFileStorageSourceRoute
        ],
        boundActions: [
            {
                type: "delete",
                deleteResource: (ids, config) => Use(APIService).resourceProviders._any_.backupservices.backupvault._any_.sources.delete(ids.resourceGroupName, ids.resourceName, config),
            }
        ],
        requestObjects: ids => 
        {
            const response = Use(APIService).resourceProviders._any_.backupservices.backupvault._any_.sources.get(ids.resourceGroupName, ids.resourceName);
            return APIMap(response, x => x.fileStorages);
        },
        schema: OpenAPISchema("BackupVaultFileStorageConfig")
    },
    displayText: "File storages",
    icon: "folder-fill",
    routingKey: "fileStorageSources",
};

const addDatabaseStorageSourceRoute: RouteSetup<ResourceAndGroupId, BackupVaultDatabaseConfig> = {
    content: {
        type: "create",
        call: (ids, newValue) => Use(APIService).resourceProviders._any_.backupservices.backupvault._any_.sources.post(ids.resourceGroupName, ids.resourceName, newValue),
        loadContext: async ids => {
            const response = await Use(APIService).resourceProviders._any_.backupservices.backupvault._any_.deploymentdata.get(ids.resourceGroupName, ids.resourceName);
            const result = await Use(APIResponseHandler).ExtractDataFromResponseOrShowErrorMessageOnError(response);
            if(result.ok === false)
                throw new Error("TODO");
            return result.value;
        },
        schema: OpenAPISchema("BackupVaultDatabaseConfig")
    },
    displayText: "Add database source",
    icon: "plus",
    routingKey: "add",
};

const databaseSourcesViewModel: RouteSetup<ResourceAndGroupId, BackupVaultDatabaseConfig> = {
    content: {
        type: "list",
        actions: [
            addDatabaseStorageSourceRoute
        ],
        boundActions: [
            {
                type: "delete",
                deleteResource: (ids, config) => Use(APIService).resourceProviders._any_.backupservices.backupvault._any_.sources.delete(ids.resourceGroupName, ids.resourceName, config),
            },
        ],
        requestObjects: ids => 
        {
            const response = Use(APIService).resourceProviders._any_.backupservices.backupvault._any_.sources.get(ids.resourceGroupName, ids.resourceName);
            return APIMap(response, x => x.databases);
        },
        schema: OpenAPISchema("BackupVaultDatabaseConfig")
    },
    displayText: "Databases",
    icon: "database",
    routingKey: "databaseSources",
};

const addKeyVaultStorageSourceRoute: RouteSetup<ResourceAndGroupId, BackupVaultKeyVaultSourceDTO> = {
    content: {
        type: "create",
        call: (ids, newValue) => Use(APIService).resourceProviders._any_.backupservices.backupvault._any_.sources.post(ids.resourceGroupName, ids.resourceName, newValue),
        loadContext: async ids => {
            const response = await Use(APIService).resourceProviders._any_.backupservices.backupvault._any_.deploymentdata.get(ids.resourceGroupName, ids.resourceName);
            const result = await Use(APIResponseHandler).ExtractDataFromResponseOrShowErrorMessageOnError(response);
            if(result.ok === false)
                throw new Error("TODO");
            return result.value;
        },
        schema: OpenAPISchema("BackupVaultKeyVaultSourceDTO")
    },
    displayText: "Add key vault source",
    icon: "plus",
    routingKey: "add",
};

const keyVaultSourcesViewModel: RouteSetup<ResourceAndGroupId, BackupVaultKeyVaultSourceDTO> = {
    content: {
        type: "list",
        actions: [
            addKeyVaultStorageSourceRoute
        ],
        boundActions: [
            {
                type: "delete",
                deleteResource: (ids, config) => Use(APIService).resourceProviders._any_.backupservices.backupvault._any_.sources.delete(ids.resourceGroupName, ids.resourceName, config),
            }
        ],
        requestObjects: ids => 
        {
            const response = Use(APIService).resourceProviders._any_.backupservices.backupvault._any_.sources.get(ids.resourceGroupName, ids.resourceName);
            return APIMap(response, x => x.keyVaults);
        },
        schema: OpenAPISchema("BackupVaultKeyVaultSourceDTO")
    },
    displayText: "Key Vaults",
    icon: "key",
    routingKey: "keyVaultSources",
};

const controllerDBSourceViewModel: RouteSetup<ResourceAndGroupId, BackupVaultControllerDatabaseConfig> = {
    content: {
        type: "object",
        actions: [
            {
                type: "edit",
                updateResource: (ids, source) => Use(APIService).resourceProviders._any_.backupservices.backupvault._any_.sources.put(ids.resourceGroupName, ids.resourceName, source),
                requestObject: ids => 
                {
                    const response = Use(APIService).resourceProviders._any_.backupservices.backupvault._any_.sources.get(ids.resourceGroupName, ids.resourceName);
                    return APIMap(response, x => x.controllerDB)
                },
                schema: OpenAPISchema("BackupVaultControllerDatabaseConfig")
            }
        ],
        formTitle: _ => "Controller Database",
        requestObject: ids => 
        {
            const response = Use(APIService).resourceProviders._any_.backupservices.backupvault._any_.sources.get(ids.resourceGroupName, ids.resourceName);
            return APIMap(response, x => x.controllerDB)
        },
        schema: OpenAPISchema("BackupVaultControllerDatabaseConfig")
    },
    displayText: "Controller Database",
    icon: "gift",
    routingKey: "controllerDBSource",
};

const triggerConfigViewModel: RouteSetup<ResourceAndGroupId, BackupVaultTrigger> = {
    content: {
        type: "object",
        actions: [
            {
                type: "edit",
                requestObject: ids => Use(APIService).resourceProviders._any_.backupservices.backupvault._any_.trigger.get(ids.resourceGroupName, ids.resourceName),
                schema: OpenAPISchema("BackupVaultTrigger"),
                updateResource: (ids, newValue) => Use(APIService).resourceProviders._any_.backupservices.backupvault._any_.trigger.put(ids.resourceGroupName, ids.resourceName, newValue)
            }
        ],
        formTitle: _ => "Backup trigger configuration",
        requestObject: ids => Use(APIService).resourceProviders._any_.backupservices.backupvault._any_.trigger.get(ids.resourceGroupName, ids.resourceName),
        schema: OpenAPISchema("BackupVaultTrigger")
    },
    displayText: "Trigger config",
    icon: "alarm",
    routingKey: "trigger",
};

const retentionConfigViewModel: RouteSetup<ResourceAndGroupId, BackupVaultRetentionConfig> = {
    content: {
        type: "object",
        actions: [
            {
                type: "edit",
                requestObject: ids => Use(APIService).resourceProviders._any_.backupservices.backupvault._any_.retention.get(ids.resourceGroupName, ids.resourceName),
                schema: OpenAPISchema("BackupVaultRetentionConfig"),
                updateResource: (ids, newValue) => Use(APIService).resourceProviders._any_.backupservices.backupvault._any_.retention.put(ids.resourceGroupName, ids.resourceName, newValue)
            }
        ],
        formTitle: _ => "Retention configuration",
        requestObject: ids => Use(APIService).resourceProviders._any_.backupservices.backupvault._any_.retention.get(ids.resourceGroupName, ids.resourceName),
        schema: OpenAPISchema("BackupVaultRetentionConfig"),
    },
    displayText: "Retention config",
    icon: "hourglass",
    routingKey: "retention",
};
 
export const backupVaultViewModel: RouteSetup<ResourceAndGroupId> = {
    content: {
        type: "multiPage",
        actions: [
            ...BuildCommonResourceActions(BuildResourceId),
        ],
        entries: [
            {
                displayName: "",
                entries: [
                    overviewViewModel,
                    logsViewModel
                ],
            },
            BuildResourceGeneralPageGroupEntry(BuildResourceId),
            {
                displayName: "Configuration",
                entries: [
                    targetConfigViewModel,
                    fileStorageSourcesViewModel,
                    databaseSourcesViewModel,
                    keyVaultSourcesViewModel,
                    controllerDBSourceViewModel,
                    triggerConfigViewModel,
                    retentionConfigViewModel
                ]
            }
        ],
        formTitle: ids => ids.resourceName,
    },
    displayText: "Backup Vault",
    icon: "safe",
    routingKey: `${resourceProviders.backupServices.name}/${resourceProviders.backupServices.backupVaultResourceType.name}/{resourceName}`,
};