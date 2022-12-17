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
import path from "path";
import { Injectable } from "acts-util-node";
import { DeploymentContext, DeploymentResult, ResourceDeletionError, ResourceProvider, ResourceTypeDefinition } from "../ResourceProvider";
import { resourceProviders } from "openprivatecloud-common";
import { VirtualMachineProperties } from "./VirtualMachineProperties";
import { ModulesManager } from "../../services/ModulesManager";
import { HostUsersManager } from "../../services/HostUsersManager";
import { RemoteCommandExecutor } from "../../services/RemoteCommandExecutor";
import { OSQueryService } from "./OSQueryService";
import { OSImageDownloader } from "./OSImageDownloader";
import { InstancesManager } from "../../services/InstancesManager";
import { HostStoragesManager } from "../../services/HostStoragesManager";
import { HostStoragesController } from "../../data-access/HostStoragesController";
import { RemoteFileSystemManager } from "../../services/RemoteFileSystemManager";
import { RemoteRootFileSystemManager } from "../../services/RemoteRootFileSystemManager";
import { VirtualMachineManager } from "./VirtualMachineManager";
import { InstanceContext } from "../../common/InstanceContext";
import { linuxSystemGroupsWithPrivileges, opcSpecialUsers } from "../../common/UserAndGroupDefinitions";
 
@Injectable
export class ComputeServicesResourceProvider implements ResourceProvider<VirtualMachineProperties>
{
    constructor(private modulesManager: ModulesManager, private hostUsersManager: HostUsersManager, private remoteCommandExecutor: RemoteCommandExecutor,
        private osQueryService: OSQueryService, private osImageDownloader: OSImageDownloader, private remoteFileSystemManager: RemoteFileSystemManager,
        private hostStoragesManager: HostStoragesManager, private hostStoragesController: HostStoragesController, private instancesManager: InstancesManager,
        private remoteRootFileSystemManager: RemoteRootFileSystemManager, private virtualMachineManager: VirtualMachineManager)
    {
    }

    //Properties
    public get name(): string
    {
        return resourceProviders.computeServices.name;
    }

    public get resourceTypeDefinitions(): ResourceTypeDefinition[]
    {
        return [
            {
                healthCheckSchedule: null,
                fileSystemType: "ext4",
                schemaName: "VirtualMachineProperties"
            }
        ];
    }

    //Public methods
    public async CheckInstanceAvailability(hostId: number, fullInstanceName: string): Promise<void>
    {
    }

    public async CheckInstanceHealth(hostId: number, fullInstanceName: string): Promise<void>
    {
    }
    
    public async DeleteResource(instanceContext: InstanceContext): Promise<ResourceDeletionError | null>
    {
        const fullInstanceName = instanceContext.fullInstanceName;
        const hostId = instanceContext.hostId;

        const parts = this.instancesManager.ExtractPartsFromFullInstanceName(fullInstanceName);
        const state = await this.virtualMachineManager.QueryVMState(hostId, parts.instanceName);
        if(state === "running")
        {
            return {
                type: "ConflictingState",
                message: "The VM is running. Shut it down before deleting it."
            };
        }

        await this.virtualMachineManager.DeleteVM(hostId, parts.instanceName);
        await this.instancesManager.RemoveInstanceStorageDirectory(hostId, instanceContext.hostStoragePath, fullInstanceName);

        return null;
    }

    public async InstancePermissionsChanged(instanceContext: InstanceContext): Promise<void>
    {
    }

    public async ProvideResource(instanceProperties: VirtualMachineProperties, context: DeploymentContext): Promise<DeploymentResult>
    {
        await this.modulesManager.EnsureModuleIsInstalled(context.hostId, "libvirt");
        //await this.hostUsersManager.EnsureHostUserIsInNativeGroup(opcSpecialUsers.host, linuxSystemGroupsWithPrivileges.kvm);

        const osInfo = await this.osQueryService.FindOSInfo(context.hostId, instanceProperties);
        const vmImagesDirPath = await this.EnsureVMImagesDirIsCreated(context.hostId);
        const isoPath = await this.osImageDownloader.DownloadImage(osInfo, context.hostId, vmImagesDirPath);

        const vmDir = await this.CreateVMDir(context);
        console.log(vmDir);
        const osDiskPath = path.join(vmDir, "os.qcow2");
        console.log(osDiskPath);

        const cmd = [
            "virt-install",
            "--connect", "qemu:///system",
            "--name", instanceProperties.name,
            //os
            "--os-variant=" + osInfo.id,
            //network
            "--network", "network=default",
            //disk
            "--disk", "path=" + osDiskPath + ",format=qcow2,size=" + instanceProperties.osDiskSize,
            //image
            "--cdrom", isoPath,
            //cpu
            "--vcpus", "2",
            //ram
            "--ram", "2048",
            //graphics
            //"--graphics", "none"
        ];

        await this.remoteCommandExecutor.ExecuteCommand(cmd, context.hostId);

        return {};
    }

    //Private methods
    private async CreateVMDir(context: DeploymentContext)
    {
        const hostId = context.hostId;

        const vmDir = await this.instancesManager.CreateInstanceStorageDirectory(hostId, context.storagePath, context.fullInstanceName);
        const uid = await this.hostUsersManager.ResolveHostUserId(hostId, opcSpecialUsers.host);
        const gid = await this.hostUsersManager.ResolveHostGroupId(hostId, linuxSystemGroupsWithPrivileges.kvm);
        await this.remoteRootFileSystemManager.ChangeOwnerAndGroup(hostId, vmDir, uid, gid);

        return vmDir;
    }

    private async EnsureVMImagesDirIsCreated(hostId: number)
    {
        const vmImagesStorageId = await this.hostStoragesManager.FindOptimalStorage(hostId, "btrfs");
        const vmImagesStorage = await this.hostStoragesController.RequestHostStorage(vmImagesStorageId);
        const vmImagesDirPath = path.join(vmImagesStorage!.path, "vm-images");

        const result = await this.remoteFileSystemManager.CreateDirectory(hostId, vmImagesDirPath);
        if(result === null)
        {
            const uid = await this.hostUsersManager.ResolveHostUserId(hostId, opcSpecialUsers.host);
            const gid = await this.hostUsersManager.ResolveHostGroupId(hostId, linuxSystemGroupsWithPrivileges.kvm);
            await this.remoteRootFileSystemManager.ChangeOwnerAndGroup(hostId, vmImagesDirPath, uid, gid);
            await this.remoteFileSystemManager.ChangeMode(hostId, vmImagesDirPath, 0o755);
        }

        return vmImagesDirPath;
    }
}