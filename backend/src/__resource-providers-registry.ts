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

import { GlobalInjector } from "acts-util-node";
import { ResourceProviderManager } from "./services/ResourceProviderManager";
import { BackupServicesResourceProvider } from "./resource-providers/backup-services/BackupServicesResourceProvider";
import { ComputeServicesResourceProvider } from "./resource-providers/compute-services/ComputeServicesResourceProvider";
import { FileServicesResourceProvider } from "./resource-providers/file-services/FileServicesResourceProvider";
import { NetworkServicesResourceProvider } from "./resource-providers/network-services/NetworkServicesResourceProvider";
import { DatabaseServicesResourceProvider } from "./resource-providers/database-services/DatabaseServicesResourceProvider";
import { WebServicesResourceProvider } from "./resource-providers/web-services/WebServicesResourceProvider";
import { MultimediaServicesResourceProvider } from "./resource-providers/multimedia-services/MultimediaServicesResourceProvider";

function RegisterResourceProviders()
{
    const resourceProviders = [
        BackupServicesResourceProvider,
        ComputeServicesResourceProvider,
        DatabaseServicesResourceProvider,
        FileServicesResourceProvider,
        MultimediaServicesResourceProvider,
        NetworkServicesResourceProvider,
        WebServicesResourceProvider
    ];

    const rpm = GlobalInjector.Resolve(ResourceProviderManager);
    for (const resourceProvider of resourceProviders)
        rpm.Register(resourceProvider);
}

RegisterResourceProviders();