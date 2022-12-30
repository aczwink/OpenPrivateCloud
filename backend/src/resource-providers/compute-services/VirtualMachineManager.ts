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
import { ModulesManager } from "../../services/ModulesManager";
import { RemoteCommandExecutor } from "../../services/RemoteCommandExecutor";
import { DeploymentContext, ResourceDeletionError } from "../ResourceProvider";
import { OSImageDownloader } from "./OSImageDownloader";
import { OSQueryService } from "./OSQueryService";
import { VirtualMachineProperties } from "./Properties";
import { InstancesManager } from "../../services/InstancesManager";
import { HostUsersManager } from "../../services/HostUsersManager";
import { linuxSystemGroupsWithPrivileges, opcSpecialUsers } from "../../common/UserAndGroupDefinitions";
import { RemoteRootFileSystemManager } from "../../services/RemoteRootFileSystemManager";
import { HostStoragesManager } from "../../services/HostStoragesManager";
import { HostStoragesController } from "../../data-access/HostStoragesController";
import { RemoteFileSystemManager } from "../../services/RemoteFileSystemManager";
import { InstanceContext } from "../../common/InstanceContext";

type VMState = "running" | "shut off";

@Injectable
export class VirtualMachineManager
{
    constructor(private remoteCommandExecutor: RemoteCommandExecutor, private modulesManager: ModulesManager, private osQueryService: OSQueryService,
        private osImageDownloader: OSImageDownloader, private instancesManager: InstancesManager, private hostUsersManager: HostUsersManager,
        private remoteRootFileSystemManager: RemoteRootFileSystemManager, private hostStoragesManager: HostStoragesManager,
        private hostStoragesController: HostStoragesController, private remoteFileSystemManager: RemoteFileSystemManager)
    {
    }

    //Public methods
    public async DeleteResource(instanceContext: InstanceContext): Promise<ResourceDeletionError | null>
    {
        const fullInstanceName = instanceContext.fullInstanceName;
        const hostId = instanceContext.hostId;

        const parts = this.instancesManager.ExtractPartsFromFullInstanceName(instanceContext.fullInstanceName);
        const state = await this.QueryVMState(hostId, parts.instanceName);
        if(state === "running")
        {
            return {
                type: "ConflictingState",
                message: "The VM is running. Shut it down before deleting it."
            };
        }

        await this.remoteCommandExecutor.ExecuteCommand(["virsh", "--connect", "qemu:///system", "undefine", "--domain", parts.instanceName], hostId);
        await this.instancesManager.RemoveInstanceStorageDirectory(hostId, instanceContext.hostStoragePath, fullInstanceName);

        return null;
    }

    public async ExecuteAction(hostId: number, instanceName: string, action: "destroy" | "start" | "shutdown")
    {
        const command = ["virsh", "--connect", "qemu:///system"];
        switch(action)
        {
            case "destroy":
                command.push("destroy", instanceName, "--graceful");
                break;
            case "shutdown":
            case "start":
                command.push(action, instanceName);
                break;
        }
        await this.remoteCommandExecutor.ExecuteCommand(command, hostId);
    }

    public async ProvideResource(instanceProperties: VirtualMachineProperties, context: DeploymentContext)
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
    }

    public async QueryVMState(hostId: number, instanceName: string): Promise<VMState>
    {
        const { stdOut } = await this.remoteCommandExecutor.ExecuteBufferedCommand(["virsh", "--connect", "qemu:///system", "domstate", "--domain", instanceName], hostId);
        return stdOut.trim() as any;
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