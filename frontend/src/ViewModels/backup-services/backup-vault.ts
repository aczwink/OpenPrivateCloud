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
import { BackupVaultDatabaseConfig, BackupVaultDeploymentDataDto, BackupVaultFileStorageConfig, BackupVaultRetentionConfig, BackupVaultTargetConfig, BackupVaultTrigger, InstanceLog, InstanceLogOverviewData } from "../../../dist/api";
import { ListViewModel } from "../../UI/ListViewModel";
import { ExtractDataFromResponseOrShowErrorMessageOnError } from "../../UI/ResponseHandler";
import { CollectionViewModel, MultiPageViewModel, ObjectViewModel } from "../../UI/ViewModel";

type ResourceAndGroupId = { resourceGroupName: string; resourceName: string };

function BuildResourceId(resourceGroupName: string, resourceName: string)
{
    return "/" + resourceGroupName + "/" + resourceProviders.backupServices.name + "/" + resourceProviders.backupServices.backupVaultResourceType.name + "/" + resourceName;
}

const overviewViewModel: ObjectViewModel<BackupVaultDeploymentDataDto, ResourceAndGroupId>  = {
    type: "object",
    actions: [
        {
            type: "activate",
            execute: (service, ids) => service.resourceProviders._any_.backupservices.backupvault._any_.post(ids.resourceGroupName, ids.resourceName),
            matIcon: "backup",
            title: "Start backup"
        }
    ],
    formTitle: _ => "Overview",
    requestObject: (service, ids) => service.resourceProviders._any_.backupservices.backupvault._any_.deploymentdata.get(ids.resourceGroupName, ids.resourceName),
    schemaName: "BackupVaultDeploymentDataDto",
};

const targetConfigViewModel: ObjectViewModel<BackupVaultTargetConfig, ResourceAndGroupId> = {
    actions: [
        {
            type: "edit",
            propertiesSchemaName: "BackupVaultTargetConfig",
            requestObject: async (service, ids) => service.resourceProviders._any_.backupservices.backupvault._any_.target.get(ids.resourceGroupName, ids.resourceName),
            updateResource: (service, ids, newValue) => service.resourceProviders._any_.backupservices.backupvault._any_.target.put(ids.resourceGroupName, ids.resourceName, newValue)
        }
    ],
    formTitle: _ => "Backup target configuration",
    requestObject: async (service, ids) => service.resourceProviders._any_.backupservices.backupvault._any_.target.get(ids.resourceGroupName, ids.resourceName),
    schemaName: "BackupVaultTargetConfig",
    type: "object"
};

const fileStorageSourcesViewModel: ListViewModel<BackupVaultFileStorageConfig, ResourceAndGroupId> = {
    actions: [
        {
            type: "create",
            createResource: (service, ids, newValue) => service.resourceProviders._any_.backupservices.backupvault._any_.sources.post(ids.resourceGroupName, ids.resourceName, newValue),
            loadContext: async (service, ids) => {
                const response = await service.resourceProviders._any_.backupservices.backupvault._any_.deploymentdata.get(ids.resourceGroupName, ids.resourceName);
                const result = ExtractDataFromResponseOrShowErrorMessageOnError(response);
                if(result.ok === false)
                    throw new Error("TODO");
                return result.value;
            }
        }
    ],
    boundActions: [
        {
            type: "delete",
            deleteResource: (service, ids, config) => service.resourceProviders._any_.backupservices.backupvault._any_.sources.delete(ids.resourceGroupName, ids.resourceName, { fullInstanceSourceName: config.fullInstanceName }),
        }
    ],
    displayName: "File storage to backup",
    requestObjects: async (service, ids) => 
    {
        const response = await service.resourceProviders._any_.backupservices.backupvault._any_.sources.get(ids.resourceGroupName, ids.resourceName);
        const data = ExtractDataFromResponseOrShowErrorMessageOnError(response);
        if(data.ok)
        {
            return {
                data: data.value.fileStorages,
                rawBody: response.rawBody,
                statusCode: response.statusCode
            };
        }
        return response;
    },
    schemaName: "BackupVaultFileStorageConfig",
    type: "list"
};

const databaseSourcesViewModel: ListViewModel<BackupVaultDatabaseConfig, ResourceAndGroupId> = {
    type: "list",
    actions: [
        {
            type: "create",
            createResource: (service, ids, newValue) => service.resourceProviders._any_.backupservices.backupvault._any_.sources.post(ids.resourceGroupName, ids.resourceName, newValue),
            loadContext: async (service, ids) => {
                const response = await service.resourceProviders._any_.backupservices.backupvault._any_.deploymentdata.get(ids.resourceGroupName, ids.resourceName);
                const result = ExtractDataFromResponseOrShowErrorMessageOnError(response);
                if(result.ok === false)
                    throw new Error("TODO");
                return result.value;
            }
        }
    ],
    boundActions: [
        {
            type: "delete",
            deleteResource: (service, ids, config) => service.resourceProviders._any_.backupservices.backupvault._any_.sources.delete(ids.resourceGroupName, ids.resourceName, { fullInstanceSourceName: config.fullInstanceName }),
        }
    ],
    displayName: "Databases to backup",
    requestObjects: async (service, ids) => 
    {
        const response = await service.resourceProviders._any_.backupservices.backupvault._any_.sources.get(ids.resourceGroupName, ids.resourceName);
        const data = ExtractDataFromResponseOrShowErrorMessageOnError(response);
        if(data.ok)
        {
            return {
                data: data.value.databases,
                rawBody: response.rawBody,
                statusCode: response.statusCode
            };
        }
        return response;
    },
    schemaName: "BackupVaultDatabaseConfig"
};

const triggerConfigViewModel: ObjectViewModel<BackupVaultTrigger, ResourceAndGroupId> = {
    actions: [
        {
            type: "edit",
            propertiesSchemaName: "BackupVaultTrigger",
            requestObject: async (service, ids) => service.resourceProviders._any_.backupservices.backupvault._any_.trigger.get(ids.resourceGroupName, ids.resourceName),
            updateResource: (service, ids, newValue) => service.resourceProviders._any_.backupservices.backupvault._any_.trigger.put(ids.resourceGroupName, ids.resourceName, newValue)
        }
    ],
    formTitle: _ => "Backup trigger configuration",
    requestObject: async (service, ids) => service.resourceProviders._any_.backupservices.backupvault._any_.trigger.get(ids.resourceGroupName, ids.resourceName),
    schemaName: "BackupVaultTrigger",
    type: "object"
};

const retentionConfigViewModel: ObjectViewModel<BackupVaultRetentionConfig, ResourceAndGroupId> = {
    actions: [
        {
            type: "edit",
            propertiesSchemaName: "BackupVaultRetentionConfig",
            requestObject: async (service, ids) => service.resourceProviders._any_.backupservices.backupvault._any_.retention.get(ids.resourceGroupName, ids.resourceName),
            updateResource: (service, ids, newValue) => service.resourceProviders._any_.backupservices.backupvault._any_.retention.put(ids.resourceGroupName, ids.resourceName, newValue)
        }
    ],
    formTitle: _ => "Retention configuration",
    requestObject: (service, ids) => service.resourceProviders._any_.backupservices.backupvault._any_.retention.get(ids.resourceGroupName, ids.resourceName),
    schemaName: "BackupVaultRetentionConfig",
    type: "object"
};

const logViewModel: ObjectViewModel<InstanceLog, ResourceAndGroupId & { logId: number}> = {
    type: "object",
    actions: [],
    formTitle: _ => "Log",
    requestObject: (service, ids) => service.resources.logs._any_.get(ids.logId),
    schemaName: "InstanceLog",
};

const logsViewModel: CollectionViewModel<InstanceLogOverviewData, ResourceAndGroupId> = {
    type: "collection",
    actions: [],
    child: logViewModel,
    displayName: "Logs",
    extractId: x => x.logId,
    idKey: "logId",
    requestObjects: (service, ids) => service.resources.logs.get({ fullInstanceName: BuildResourceId(ids.resourceGroupName, ids.resourceName) }),
    schemaName: "InstanceLogOverviewData",
};
 
export const backupVaultViewModel: MultiPageViewModel<ResourceAndGroupId> = {
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
                    child: overviewViewModel,
                },
                {
                    key: "target",
                    displayName: "Target config",
                    child: targetConfigViewModel
                },
                {
                    key: "fileStorageSources",
                    displayName: "File storages",
                    child: fileStorageSourcesViewModel
                },
                {
                    key: "databaseSources",
                    displayName: "Databases",
                    child: databaseSourcesViewModel,
                },
                {
                    key: "trigger",
                    displayName: "Trigger config",
                    child: triggerConfigViewModel
                },
                {
                    key: "retention",
                    displayName: "Retention config",
                    child: retentionConfigViewModel
                },
                {
                    key: "logs",
                    displayName: "Logs",
                    child: logsViewModel,
                }
            ]
        }
    ],
    formTitle: ids => ids.resourceName,
    type: "multiPage"
};