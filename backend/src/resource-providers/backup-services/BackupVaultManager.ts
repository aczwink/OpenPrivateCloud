/**
 * OpenPrivateCloud
 * Copyright (C) 2019-2022 Amir Czwink (amir130@hotmail.de)
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

import { GlobalInjector, Injectable } from "acts-util-node";
import { HostStoragesController } from "../../data-access/HostStoragesController";
import { InstanceConfigController } from "../../data-access/InstanceConfigController";
import { InstanceLogsController } from "../../data-access/InstanceLogsController";
import { InstancesController } from "../../data-access/InstancesController";
import { InstancesManager } from "../../services/InstancesManager";
import { MountsManager } from "../../services/MountsManager";
import { ProcessTrackerManager } from "../../services/ProcessTrackerManager";
import { RemoteCommandExecutor } from "../../services/RemoteCommandExecutor";
import { RemoteFileSystemManager } from "../../services/RemoteFileSystemManager";
import { RemoteRootFileSystemManager } from "../../services/RemoteRootFileSystemManager";
import { FileStoragesManager } from "../file-services/FileStoragesManager";
import { BtrfsDiskBackupper } from "./BtrfsDiskBackupper";
import { BackupVaultSourcesConfig, BackupVaultTargetConfig } from "./models";

interface BackupVaultConfig
{
    sources: BackupVaultSourcesConfig;
    target: BackupVaultTargetConfig;
}

@Injectable
export class BackupVaultManager
{
    constructor(private hostConfigController: InstanceConfigController, private instancesController: InstancesController,
        private hostStoragesController: HostStoragesController, private processTrackerManager: ProcessTrackerManager, private instanceLogsController: InstanceLogsController)
    {
    }

    //Public methods
    public async ReadConfig(instanceId: number): Promise<BackupVaultConfig>
    {
        const config = await this.hostConfigController.RequestConfig<BackupVaultConfig>(instanceId);

        if(config === undefined)
        {
            return {
                sources: {
                    fileStorages: []
                },
                target: {
                    type: "storage-device",
                    storageDevicePath: ""
                }
            };
        }

        return config;
    }

    public async StartBackupProcess(instanceId: number)
    {
        const inj = GlobalInjector;

        const processTracker = this.processTrackerManager.Create();

        const config = await this.ReadConfig(instanceId);
        const backupper = new BtrfsDiskBackupper(
            processTracker,
            inj.Resolve(MountsManager), inj.Resolve(FileStoragesManager), this.instancesController,
            this.hostStoragesController, inj.Resolve(RemoteFileSystemManager), inj.Resolve(InstancesManager),
            inj.Resolve(RemoteRootFileSystemManager), inj.Resolve(RemoteCommandExecutor)
        );

        const instance = await this.instancesController.QueryInstanceById(instanceId);
        const storage = await this.hostStoragesController.RequestHostStorage(instance!.storageId);

        await backupper.Backup(storage!.hostId, config.sources, config.target.storageDevicePath);
        await this.instanceLogsController.AddInstanceLog(instanceId, processTracker);
    }

    public async WriteConfig(instanceId: number, config: BackupVaultConfig)
    {
        await this.hostConfigController.UpdateOrInsertConfig(instanceId, config);
    }
}