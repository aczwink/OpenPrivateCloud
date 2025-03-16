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

import { RouteSetup } from "acfrontendex";
import { ResourceListComponent } from "../components/resources/ResourceListComponent";
import { mariadbViewModel } from "./database-services/mariadb";
import { keyVaultViewModel } from "./security-services/key-vault";
import { openVPNGatewayViewModel } from "./network-services/openvpn-gateway";
import { backupVaultViewModel } from "./backup-services/backup-vault";
import { dockerContainerViewModel } from "./compute-services/docker-container";
import { vnetViewModel } from "./network-services/virtual-network";
import { virtualMachineViewModel } from "./compute-services/virtual-machine";
import { fileStorageViewModel } from "./file-services/file-storage";
import { avTranscoderViewModel } from "./multimedia-services/av-transcoder";
import { dnsServerViewModel } from "./network-services/dns-server";
import { wafViewModel } from "./security-services/waf";
import { appGatewayViewModel } from "./web-services/app-gateway";
import { jdownloaderViewModel } from "./web-services/jdownloader";
import { letsEncryptViewModel } from "./web-services/letsencrypt-cert";
import { nextcloudViewModel } from "./web-services/nextcloud";
import { nodeAppServiceViewodel } from "./web-services/node-app-service";
import { staticWebsiteViewModel } from "./web-services/static-website";
import { JSX_CreateElement } from "acfrontend";

type ResourceAndGroupId = { resourceGroupName: string; resourceName: string };

export const resourceTypesRoutes: RouteSetup<ResourceAndGroupId>[] = [
    backupVaultViewModel,
    dockerContainerViewModel,
    virtualMachineViewModel,
    mariadbViewModel,
    fileStorageViewModel,
    avTranscoderViewModel,
    dnsServerViewModel,
    openVPNGatewayViewModel,
    vnetViewModel,
    keyVaultViewModel,
    wafViewModel,
    appGatewayViewModel,
    jdownloaderViewModel,
    letsEncryptViewModel,
    nextcloudViewModel,
    nodeAppServiceViewodel,
    staticWebsiteViewModel
];

export const resourcesRoute: RouteSetup<{}> = {
    content: {
        type: "routing",
        entries: [
            ...resourceTypesRoutes,
            {
                content: {
                    type: "element",
                    element: () => <ResourceListComponent query={apiService => apiService.resources.get()} />
                },
                displayText: "Resources",
                icon: "collection",
                routingKey: "",
            }
        ],
    },
    displayText: "Resources",
    icon: "collection",
    requiredScopes: ["admin"],
    routingKey: "resources",
};