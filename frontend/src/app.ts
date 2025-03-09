/**
 * OpenPrivateCloud
 * Copyright (C) 2019-2025 Amir Czwink (amir130@hotmail.de)
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

import { BootstrapApp, CreateOAuth2RedirectURIs } from "acfrontendex";
import { dashboardRoute } from "./routes/dashboard";
import { clusterRoute } from "./routes/cluster";
import { hostsRoute } from "./routes/hosts";
import root from "../dist/openapi.json";
import { OpenAPI } from "acts-util-core";
import { activityMonitorRoute } from "./routes/activity-monitor";
import { accessRoute } from "./routes/access";
import { dataExplorerRoute } from "./routes/data-explorer";
import { resourcesRoute } from "./routes/resources";
import { resourceGroupsRoute } from "./routes/resource-groups";
import { RegisterCustomFormats } from "./components/custom-formats/custom-formats";
import { userSettingsViewModel } from "./routes/usersettings";
import ENV from "./env";

RegisterCustomFormats();

BootstrapApp({
    additionalRoutes: [activityMonitorRoute],

    features: {
        oAuth2: {
            authorizeEndpoint: ENV.AUTH_ENDPOINT,
            clientId: ENV.CLIENT_ID,
            endSessionEndpoint: ENV.ENDSESSION_ENDPOINT,
            flow: "authorizationCode",
            tokenEndpoint: ENV.TOKEN_ENDPOINT,
            ...CreateOAuth2RedirectURIs(ENV.FRONTEND_BASEURL),
        },

        openAPI: root as OpenAPI.Root,
    },

    layout: {
        navbar: [
            [dashboardRoute, resourcesRoute, resourceGroupsRoute, dataExplorerRoute],
            [accessRoute, hostsRoute, clusterRoute],
            [userSettingsViewModel] //TODO: should go to user layout part as soon as oauth2 integration is done
        ],
        user: [],
    },

    mountPoint: document.body,

    title: "OpenPrivateCloud",
    version: "0.1 beta"
});