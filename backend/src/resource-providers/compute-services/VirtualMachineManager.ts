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
import path from "path";
import { Injectable } from "acts-util-node";
import { ModulesManager } from "../../services/ModulesManager";
import { RemoteCommandExecutor } from "../../services/RemoteCommandExecutor";
import { DeploymentContext, ResourceDeletionError, ResourceStateResult } from "../ResourceProvider";
import { OSImageDownloader } from "./OSImageDownloader";
import { OSQueryService } from "./OSQueryService";
import { VirtualMachineProperties } from "./Properties";
import { ResourcesManager } from "../../services/ResourcesManager";
import { HostUsersManager } from "../../services/HostUsersManager";
import { linuxSystemGroupsWithPrivileges, opcSpecialUsers } from "../../common/UserAndGroupDefinitions";
import { RemoteRootFileSystemManager } from "../../services/RemoteRootFileSystemManager";
import { HostStoragesManager } from "../../services/HostStoragesManager";
import { HostStoragesController } from "../../data-access/HostStoragesController";
import { RemoteFileSystemManager } from "../../services/RemoteFileSystemManager";
import { LightweightResourceReference, ResourceReference } from "../../common/ResourceReference";
import { LinuxUsersManager } from "../../services/LinuxUsersManager";

type VMState = "running" | "shut off";

@Injectable
export class VirtualMachineManager
{
    constructor(private remoteCommandExecutor: RemoteCommandExecutor, private modulesManager: ModulesManager, private osQueryService: OSQueryService, private linuxUsersManager: LinuxUsersManager,
        private osImageDownloader: OSImageDownloader, private resourcesManager: ResourcesManager, private hostUsersManager: HostUsersManager,
        private remoteRootFileSystemManager: RemoteRootFileSystemManager, private hostStoragesManager: HostStoragesManager,
        private hostStoragesController: HostStoragesController, private remoteFileSystemManager: RemoteFileSystemManager)
    {
    }

    //Public methods
    public async DeleteResource(resourceReference: ResourceReference): Promise<ResourceDeletionError | null>
    {
        const result = await this.DeleteDomainIfExisting(resourceReference);
        if(result !== null)
            return result;

        await this.resourcesManager.RemoveResourceStorageDirectory(resourceReference);

        return null;
    }

    public async ExecuteAction(resourceReference: LightweightResourceReference, action: "destroy" | "start" | "shutdown")
    {
        const command = ["virsh", "--connect", "qemu:///system"];
        const vmName = this.DeriveVMName(resourceReference);
        switch(action)
        {
            case "destroy":
                command.push("destroy", vmName, "--graceful");
                break;
            case "shutdown":
            case "start":
                command.push(action, vmName);
                break;
        }
        await this.remoteCommandExecutor.ExecuteCommand(command, resourceReference.hostId);
    }

    public async QueryResourceState(resourceReference: LightweightResourceReference): Promise<ResourceStateResult>
    {
        const state = await this.QueryVMState(resourceReference);
        if(state === undefined)
            return "corrupt";
        switch(state)
        {
            case "running":
                return "running";
            case "shut off":
                return "stopped";
        }
    }

    public async ProvideResource(instanceProperties: VirtualMachineProperties, context: DeploymentContext)
    {
        await this.modulesManager.EnsureModuleIsInstalled(context.hostId, "libvirt");
        await this.linuxUsersManager.EnsureUserIsInGroup(context.hostId, opcSpecialUsers.host.name, linuxSystemGroupsWithPrivileges.kvm);

        const osInfo = await this.osQueryService.FindOSInfo(context.hostId, instanceProperties);
        const vmImagesDirPath = await this.EnsureVMImagesDirIsCreated(context.hostId);
        const isoPath = await this.osImageDownloader.DownloadImage(osInfo, context.hostId, vmImagesDirPath);

        const vmDir = await this.CreateVMDir(context);
        const osDiskPath = path.join(vmDir, "os.qcow2");

        const vmName = this.DeriveVMName(context.resourceReference);
        const cmd = [
            "virt-install",
            "--connect", "qemu:///system",
            "--name", vmName,
            "--metadata", 'title="' + instanceProperties.name + '"',
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

    public async QueryVMState(resourceReference: LightweightResourceReference): Promise<VMState | undefined>
    {
        const vmName = this.DeriveVMName(resourceReference);
        const result = await this.remoteCommandExecutor.ExecuteBufferedCommandWithExitCode(["virsh", "--connect", "qemu:///system", "domstate", "--domain", vmName], resourceReference.hostId);
        if(result.exitCode === 1)
            return undefined;
        return result.stdOut.trim() as any;
    }

    //Private methods
    private async CreateVMDir(context: DeploymentContext)
    {
        const hostId = context.hostId;

        const vmDir = await this.resourcesManager.CreateResourceStorageDirectory(context.resourceReference);
        const uid = await this.hostUsersManager.ResolveHostUserId(hostId, opcSpecialUsers.host.name);
        const gid = await this.hostUsersManager.ResolveHostGroupId(hostId, linuxSystemGroupsWithPrivileges.kvm);
        await this.remoteRootFileSystemManager.ChangeOwnerAndGroup(hostId, vmDir, uid, gid);

        return vmDir;
    }

    private async DeleteDomainIfExisting(resourceReference: LightweightResourceReference): Promise<ResourceDeletionError | null>
    {
        const state = await this.QueryVMState(resourceReference);
        if(state === undefined)
        {
            //domain is not there, probably because of a failed deployment
            return null;
        }

        if(state === "running")
        {
            return {
                type: "ConflictingState",
                message: "The VM is running. Shut it down before deleting it."
            };
        }

        const vmName = this.DeriveVMName(resourceReference);
        await this.remoteCommandExecutor.ExecuteCommand(["virsh", "--connect", "qemu:///system", "undefine", "--domain", vmName], resourceReference.hostId);

        return null;
    }

    private DeriveVMName(resourceReference: LightweightResourceReference)
    {
        return "opc-rvm-" + resourceReference.id;
    }

    private async EnsureVMImagesDirIsCreated(hostId: number)
    {
        const vmImagesStorageId = await this.hostStoragesManager.FindOptimalStorage(hostId, "btrfs");
        const vmImagesStorage = await this.hostStoragesController.RequestHostStorage(vmImagesStorageId);
        const vmImagesDirPath = path.join(vmImagesStorage!.path, "vm-images");

        const result = await this.remoteFileSystemManager.CreateDirectory(hostId, vmImagesDirPath);
        if(result === null)
        {
            const uid = await this.hostUsersManager.ResolveHostUserId(hostId, opcSpecialUsers.host.name);
            const gid = await this.hostUsersManager.ResolveHostGroupId(hostId, linuxSystemGroupsWithPrivileges.kvm);
            await this.remoteRootFileSystemManager.ChangeOwnerAndGroup(hostId, vmImagesDirPath, uid, gid);
            await this.remoteFileSystemManager.ChangeMode(hostId, vmImagesDirPath, 0o755);
        }

        return vmImagesDirPath;
    }
}