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
import { BackupVaultControllerDatabaseConfig, BackupVaultDatabaseConfig, BackupVaultDeploymentDataDto, BackupVaultFileStorageConfig, BackupVaultKeyVaultSourceDTO, BackupVaultObjectStorageSourceDTO, BackupVaultRetentionConfig, BackupVaultTargetConfigDTO, BackupVaultTrigger, InstanceLog, ResourceLogOverviewData } from "../../../dist/api";
import { ListViewModel } from "../../UI/ListViewModel";
import { ExtractDataFromResponseOrShowErrorMessageOnError } from "../../UI/ResponseHandler";
import { CollectionViewModel, MultiPageViewModel, ObjectViewModel } from "../../UI/ViewModel";
import { BuildCommonResourceActions, BuildResourceGeneralPageGroupEntry } from "../shared/resourcegeneral";

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

const targetConfigViewModel: ObjectViewModel<BackupVaultTargetConfigDTO, ResourceAndGroupId> = {
    actions: [
        {
            type: "edit",
            propertiesSchemaName: "BackupVaultTargetConfigDTO",
            requestObject: async (service, ids) => service.resourceProviders._any_.backupservices.backupvault._any_.target.get(ids.resourceGroupName, ids.resourceName),
            updateResource: (service, ids, newValue) => service.resourceProviders._any_.backupservices.backupvault._any_.target.put(ids.resourceGroupName, ids.resourceName, newValue)
        }
    ],
    formTitle: _ => "Backup target configuration",
    requestObject: async (service, ids) => service.resourceProviders._any_.backupservices.backupvault._any_.target.get(ids.resourceGroupName, ids.resourceName),
    schemaName: "BackupVaultTargetConfigDTO",
    type: "object"
};

const fileStorageSourcesViewModel: ListViewModel<BackupVaultFileStorageConfig, ResourceAndGroupId> = {
    actions: [
        {
            type: "create",
            createResource: (service, ids, newValue) => service.resourceProviders._any_.backupservices.backupvault._any_.sources.post(ids.resourceGroupName, ids.resourceName, newValue),
            loadContext: async (service, ids) => {
                const response = await service.resourceProviders._any_.backupservices.backupvault._any_.deploymentdata.get(ids.resourceGroupName, ids.resourceName);
                const result = await ExtractDataFromResponseOrShowErrorMessageOnError(response);
                if(result.ok === false)
                    throw new Error("TODO");
                return result.value;
            }
        }
    ],
    boundActions: [
        {
            type: "delete",
            deleteResource: (service, ids, config) => service.resourceProviders._any_.backupservices.backupvault._any_.sources.delete(ids.resourceGroupName, ids.resourceName, config),
        }
    ],
    displayName: "File storage to backup",
    requestObjects: async (service, ids) => 
    {
        const response = await service.resourceProviders._any_.backupservices.backupvault._any_.sources.get(ids.resourceGroupName, ids.resourceName);
        const data = await ExtractDataFromResponseOrShowErrorMessageOnError(response);
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

const objectStorageSourcesViewModel: ListViewModel<BackupVaultObjectStorageSourceDTO, ResourceAndGroupId> = {
    actions: [
        {
            type: "create",
            createResource: (service, ids, newValue) => service.resourceProviders._any_.backupservices.backupvault._any_.sources.post(ids.resourceGroupName, ids.resourceName, newValue),
            loadContext: async (service, ids) => {
                const response = await service.resourceProviders._any_.backupservices.backupvault._any_.deploymentdata.get(ids.resourceGroupName, ids.resourceName);
                const result = await ExtractDataFromResponseOrShowErrorMessageOnError(response);
                if(result.ok === false)
                    throw new Error("TODO");
                return result.value;
            }
        }
    ],
    boundActions: [
        {
            type: "delete",
            deleteResource: (service, ids, config) => service.resourceProviders._any_.backupservices.backupvault._any_.sources.delete(ids.resourceGroupName, ids.resourceName, config),
        }
    ],
    displayName: "Object storages to backup",
    requestObjects: async (service, ids) => 
    {
        const response = await service.resourceProviders._any_.backupservices.backupvault._any_.sources.get(ids.resourceGroupName, ids.resourceName);
        const data = await ExtractDataFromResponseOrShowErrorMessageOnError(response);
        if(data.ok)
        {
            return {
                data: data.value.objectStorages,
                rawBody: response.rawBody,
                statusCode: response.statusCode
            };
        }
        return response;
    },
    schemaName: "BackupVaultObjectStorageSourceDTO",
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
                const result = await ExtractDataFromResponseOrShowErrorMessageOnError(response);
                if(result.ok === false)
                    throw new Error("TODO");
                return result.value;
            }
        }
    ],
    boundActions: [
        {
            type: "delete",
            deleteResource: (service, ids, config) => service.resourceProviders._any_.backupservices.backupvault._any_.sources.delete(ids.resourceGroupName, ids.resourceName, config),
        }
    ],
    displayName: "Databases to backup",
    requestObjects: async (service, ids) => 
    {
        const response = await service.resourceProviders._any_.backupservices.backupvault._any_.sources.get(ids.resourceGroupName, ids.resourceName);
        const data = await ExtractDataFromResponseOrShowErrorMessageOnError(response);
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

const keyVaultSourcesViewModel: ListViewModel<BackupVaultKeyVaultSourceDTO, ResourceAndGroupId> = {
    actions: [
        {
            type: "create",
            createResource: (service, ids, newValue) => service.resourceProviders._any_.backupservices.backupvault._any_.sources.post(ids.resourceGroupName, ids.resourceName, newValue),
            loadContext: async (service, ids) => {
                const response = await service.resourceProviders._any_.backupservices.backupvault._any_.deploymentdata.get(ids.resourceGroupName, ids.resourceName);
                const result = await ExtractDataFromResponseOrShowErrorMessageOnError(response);
                if(result.ok === false)
                    throw new Error("TODO");
                return result.value;
            }
        }
    ],
    boundActions: [
        {
            type: "delete",
            deleteResource: (service, ids, config) => service.resourceProviders._any_.backupservices.backupvault._any_.sources.delete(ids.resourceGroupName, ids.resourceName, config),
        }
    ],
    displayName: "Key Vaults to backup",
    requestObjects: async (service, ids) => 
    {
        const response = await service.resourceProviders._any_.backupservices.backupvault._any_.sources.get(ids.resourceGroupName, ids.resourceName);
        const data = await ExtractDataFromResponseOrShowErrorMessageOnError(response);
        if(data.ok)
        {
            return {
                data: data.value.keyVaults,
                rawBody: response.rawBody,
                statusCode: response.statusCode
            };
        }
        return response;
    },
    schemaName: "BackupVaultKeyVaultSourceDTO",
    type: "list"
};

const controllerDBSourceViewModel: ObjectViewModel<BackupVaultControllerDatabaseConfig, ResourceAndGroupId> = {
    type: "object",
    actions: [
        {
            type: "edit",
            updateResource: (service, ids, source) => service.resourceProviders._any_.backupservices.backupvault._any_.sources.put(ids.resourceGroupName, ids.resourceName, source),
            propertiesSchemaName: "BackupVaultControllerDatabaseConfig",
            requestObject: async (service, ids) => 
            {
                const response = await service.resourceProviders._any_.backupservices.backupvault._any_.sources.get(ids.resourceGroupName, ids.resourceName);
                const data = await ExtractDataFromResponseOrShowErrorMessageOnError(response);
                if(data.ok)
                {
                    return {
                        data: data.value.controllerDB,
                        rawBody: response.rawBody,
                        statusCode: response.statusCode
                    };
                }
                return response;
            },
        }
    ],
    formTitle: _ => "Controller Database",
    requestObject: async (service, ids) => 
    {
        const response = await service.resourceProviders._any_.backupservices.backupvault._any_.sources.get(ids.resourceGroupName, ids.resourceName);
        const data = await ExtractDataFromResponseOrShowErrorMessageOnError(response);
        if(data.ok)
        {
            return {
                data: data.value.controllerDB,
                rawBody: response.rawBody,
                statusCode: response.statusCode
            };
        }
        return response;
    },
    schemaName: "BackupVaultControllerDatabaseConfig"
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

const logsViewModel: CollectionViewModel<ResourceLogOverviewData, ResourceAndGroupId> = {
    type: "collection",
    actions: [],
    child: logViewModel,
    displayName: "Logs",
    extractId: x => x.logId,
    idKey: "logId",
    requestObjects: (service, ids) => service.resources.logs.get({ resourceId: BuildResourceId(ids.resourceGroupName, ids.resourceName) }),
    schemaName: "ResourceLogOverviewData",
};
 
export const backupVaultViewModel: MultiPageViewModel<ResourceAndGroupId> = {
    actions: [
        ...BuildCommonResourceActions(BuildResourceId),
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
                    key: "logs",
                    displayName: "Logs",
                    child: logsViewModel,
                }
            ]
        },
        BuildResourceGeneralPageGroupEntry(BuildResourceId),
        {
            displayName: "Configuration",
            entries: [
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
                    key: "objectStorageSources",
                    displayName: "Object storages",
                    child: objectStorageSourcesViewModel
                },
                {
                    key: "databaseSources",
                    displayName: "Databases",
                    child: databaseSourcesViewModel,
                },
                {
                    key: "keyVaultSources",
                    displayName: "Key Vaults",
                    child: keyVaultSourcesViewModel
                },
                {
                    key: "controllerDBSource",
                    displayName: "Controller Database",
                    child: controllerDBSourceViewModel,
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
            ]
        }
    ],
    formTitle: ids => ids.resourceName,
    type: "multiPage"
};