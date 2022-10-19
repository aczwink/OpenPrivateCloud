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
import { DistroPackageManager, ModuleName } from "../distro/DistroPackageManager";
import { DistroInfoService } from "./DistroInfoService";

 
@Injectable
export class ModulesManager
{
    constructor(private distroInfoService: DistroInfoService)
    {
    }
    
    //Public methods
    public async EnsureModuleIsInstalled(hostId: number, moduleName: ModuleName)
    {
        const isInstalled = await this.IsModuleInstalled(hostId, moduleName);
        if(!isInstalled)
            await this.Install(hostId, moduleName);
    }

    //Private methods
    /*private GetModuleInstaller(moduleName: string): ModuleInstaller
    {
        const installer = this._moduleDefinitions[moduleName]?.installer;
        if(installer === undefined)
        {
            return {
                async Install()
                {
                },

                async IsModuleInstalled()
                {
                    return true;
                },

                async Uninstall()
                {
                }
            };
        }

        return installer;
    }*/
    
    private async Install(hostId: number, moduleName: ModuleName)
    {
        const distroPackageManager = await this.ResolveDistroPackageManager(hostId);
        //const mod = await this.GetModuleInstaller(moduleName);

        await distroPackageManager.Install(hostId, moduleName);
        //await mod.Install();
    }

    private async IsModuleInstalled(hostId: number, moduleName: ModuleName): Promise<boolean>
    {
        const distroPackageManager = await this.ResolveDistroPackageManager(hostId);
        //const mod = await this.GetModuleInstaller(moduleName);

        return (await distroPackageManager.IsModuleInstalled(hostId, moduleName)) /*&& (await mod.IsModuleInstalled())*/;
    }

    private async ResolveDistroPackageManager(hostId: number): Promise<DistroPackageManager>
    {
        const id = await this.distroInfoService.FetchId(hostId);
        const pkg = await import("../distro/" + id + "/PackageManager");
        
        return GlobalInjector.Resolve<DistroPackageManager>(pkg.default);
    }
}