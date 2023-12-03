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
import {App, RootInjector, Routes} from "acfrontend";
import { AuthGuard } from "./AuthGuard";
import { DashboardComponent } from "./Views/DashboardComponent";
import { LoginComponent } from "./LoginComponent";
import { PageNotFoundComponent } from "./PageNotFoundComponent";
import { RootComponent } from "./RootComponent";
import { ViewModelsManager } from "./UI/ViewModelsManager";
import { ViewProcessComponent } from "./Views/activitymonitor/ViewProcessComponent";
import { DataExplorerComponent } from "./Views/data-explorer/DataExplorerComponent";

function BuildRoutes()
{
    const viewModelRegistry = RootInjector.Resolve(ViewModelsManager);
    
    const staticRoutes : Routes = [
        { path: "activitymonitor/:processId", guards: [AuthGuard], component: ViewProcessComponent },
        { path: "dataExplorer", guards: [AuthGuard], component: DataExplorerComponent },
        { path: "login", component: LoginComponent},
        { path: "", component: DashboardComponent, guards: [AuthGuard] },
        { path: "*", component: PageNotFoundComponent},
    ];
    
    return viewModelRegistry.BuildRoutes().concat(staticRoutes);
}

async function LoadViewModels()
{
    const viewModelRegistry = RootInjector.Resolve(ViewModelsManager);

    const modules = [
        import("./ViewModels/hosts"),
        import("./ViewModels/resourceGroups"),
        import("./ViewModels/cluster"),
        import("./ViewModels/usersandgroups"),
        import("./ViewModels/usersettings"),
    ];

    for (const module of modules)
    {
        const imported = await module
        viewModelRegistry.Register(imported.default);
    }
}

function RunApp(routes: Routes)
{
    const app = new App({
        mountPoint: document.body,
        rootComponentClass: RootComponent,
        routes,
        title: "OpenPrivateCloud",
        version: "0.1 beta"
    });
}

async function BootstrapApp()
{
    await LoadViewModels();
    const routes = BuildRoutes();
    RunApp(routes);
}

BootstrapApp();