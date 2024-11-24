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

import { BootstrapApp } from "acfrontendex";
import { dashboardRoute } from "./routes/dashboard";
import { loginRoute } from "./routes/login";
import { clusterRoute } from "./routes/cluster";
import { hostsRoute } from "./routes/hosts";
import root from "../dist/openapi.json";
import { OpenAPI } from "acts-util-core";
import { activityMonitorRoute } from "./routes/activity-monitor";
import { usersAndGroupsRoute } from "./routes/usersandgroups";
import { dataExplorerRoute } from "./routes/data-explorer";
import { resourcesRoute } from "./routes/resources";
import { resourceGroupsRoute } from "./routes/resource-groups";
import { RegisterCustomFormats } from "./components/custom-formats/custom-formats";
import { userSettingsViewModel } from "./routes/usersettings";
import { clusterLockedRoute } from "./routes/cluster-locked";

RegisterCustomFormats();

BootstrapApp({
    additionalRoutes: [activityMonitorRoute, clusterLockedRoute, loginRoute],

    features: {
        openAPI: root as OpenAPI.Root
    },

    layout: {
        navbar: [
            [dashboardRoute, resourcesRoute, resourceGroupsRoute, dataExplorerRoute],
            [usersAndGroupsRoute, hostsRoute, clusterRoute],
            [userSettingsViewModel] //TODO: should go to user layout part as soon as oauth2 integration is done
        ],
        user: [],
    },

    mountPoint: document.body,

    title: "OpenPrivateCloud",
    version: "0.1 beta"
});