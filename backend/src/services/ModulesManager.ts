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
import { GlobalInjector, Injectable } from "acts-util-node";
import { HostStoragesController } from "../data-access/HostStoragesController";
import { DistroPackageManager, ModuleName } from "../distro/DistroPackageManager";
import { SambaSharesManager } from "../resource-providers/file-services/SambaSharesManager";
import { DistroInfoService } from "./DistroInfoService";
import { HostStoragesManager } from "./HostStoragesManager";
import { RemoteFileSystemManager } from "./RemoteFileSystemManager";
import { SystemServicesManager } from "./SystemServicesManager";
import { RemoteCommandExecutor } from "./RemoteCommandExecutor";
import { RemoteRootFileSystemManager } from "./RemoteRootFileSystemManager";
import DebianPackageManager from "../distro/debian/PackageManager";

 
@Injectable
class InternalModulesManager
{
    constructor(private distroInfoService: DistroInfoService)
    {
    }
    
    //Public methods
    public async Install(hostId: number, moduleName: ModuleName)
    {
        const distroPackageManager = await this.ResolveDistroPackageManager(hostId);
        await distroPackageManager.Install(hostId, moduleName);
    }

    public async IsModuleInstalled(hostId: number, moduleName: ModuleName): Promise<boolean>
    {
        const distroPackageManager = await this.ResolveDistroPackageManager(hostId);
        return (await distroPackageManager.IsModuleInstalled(hostId, moduleName));
    }

    public async Uninstall(hostId: number, moduleName: ModuleName)
    {
        const distroPackageManager = await this.ResolveDistroPackageManager(hostId);
        await distroPackageManager.Uninstall(hostId, moduleName);
    }

    //Private methods
    private async ResolveDistroPackageManager(hostId: number): Promise<DistroPackageManager>
    {
        const id = await this.distroInfoService.FetchId(hostId);
        return this.ResolveDistroPackageManagerById(id!);
    }

    private ResolveDistroPackageManagerById(id: string): DistroPackageManager
    {
        switch(id)
        {
            case "debian":
            case "ubuntu":
                return GlobalInjector.Resolve(DebianPackageManager);
        }
        throw new Error("Distribution not supported: " + id);
    }
}

@Injectable
export class ModulesManager
{
    constructor(private internalModulesManager: InternalModulesManager)
    {
    }

    //Public methods
    public async EnsureModuleIsInstalled(hostId: number, moduleName: ModuleName)
    {
        const isInstalled = await this.internalModulesManager.IsModuleInstalled(hostId, moduleName);
        if(!isInstalled)
            await this.Install(hostId, moduleName);
    }

    public async Uninstall(hostId: number, moduleName: ModuleName)
    {
        await this.internalModulesManager.Uninstall(hostId, moduleName);
    }

    //Private methods
    private async Install(hostId: number, moduleName: ModuleName)
    {
        await this.internalModulesManager.Install(hostId, moduleName);
        await this.ApplyDefaultConfig(hostId, moduleName);
    }

    private async ApplyDefaultConfig(hostId: number, moduleName: ModuleName)
    {
        switch(moduleName)
        {
            case "docker":
                {
                    const distroInfoService = GlobalInjector.Resolve(DistroInfoService);
                    const hostStoragesController = GlobalInjector.Resolve(HostStoragesController);
                    const hostStoragesManager = GlobalInjector.Resolve(HostStoragesManager);
                    const remoteCommandExecutor = GlobalInjector.Resolve(RemoteCommandExecutor);
                    const remoteFileSystemManager = GlobalInjector.Resolve(RemoteFileSystemManager);
                    const remoteRootFileSystemManager = GlobalInjector.Resolve(RemoteRootFileSystemManager);
                    const systemServicesManager = GlobalInjector.Resolve(SystemServicesManager);

                    const storageId = await hostStoragesManager.FindOptimalStorage(hostId, "ext4");
                    const storage = await hostStoragesController.RequestHostStorage(storageId);
                    const dockerDataPath = path.join(storage!.path, "docker");
                    await remoteFileSystemManager.CreateDirectory(hostId, dockerDataPath);
                    
                    await systemServicesManager.StopService(hostId, "docker");

                    const dockerDaemonConfigFile = "/etc/docker/daemon.json";
                    let config;
                    try
                    {
                        const data = await remoteFileSystemManager.ReadTextFile(hostId, dockerDaemonConfigFile);
                        config = JSON.parse(data);
                    }
                    catch(_)
                    {
                        config = {};
                    }

                    config["bridge"] = "none";
                    config["data-root"] = dockerDataPath;
                    config["iptables"] = false;
                    await remoteRootFileSystemManager.WriteTextFile(hostId, dockerDaemonConfigFile, JSON.stringify(config));

                    await systemServicesManager.StartService(hostId, "docker");

                    //the standard docker bridge driver does not allow using custom bridges (at least not more than one i.e. "bridge" in the daemon.json). This plugin effectively allows us exactly that
                    const arch = await distroInfoService.FetchCPU_Architecture(hostId);
                    const pluginArch = (arch === "arm64") ? "arm64-v8" : "amd64";
                    const pluginName = "ghcr.io/aczwink/docker-net-dhcp:latest-linux-" + pluginArch;
                    await remoteCommandExecutor.ExecuteCommand(["sudo", "docker", "plugin", "install", "--grant-all-permissions", pluginName], hostId);
                }
                break;
            case "libvirt":
                {
                    const remoteCommandExecutor = GlobalInjector.Resolve(RemoteCommandExecutor);
                    const systemServicesManager = GlobalInjector.Resolve(SystemServicesManager);

                    await remoteCommandExecutor.ExecuteCommand(["virsh", "net-destroy", "default"], hostId);
                    await remoteCommandExecutor.ExecuteCommand(["virsh", "net-undefine", "default"], hostId);

                    await systemServicesManager.RestartService(hostId, "nftables"); //reload firewall rules
                }
                break;
            case "samba":
                const smbMgr = GlobalInjector.Resolve(SambaSharesManager)
                await smbMgr.DeleteShare(hostId, "print$");
                break;
        }
    }
}