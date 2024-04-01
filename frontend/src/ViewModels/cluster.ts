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

import { MailerSettings } from "../../dist/api";
import { ComponentViewModel, MultiPageViewModel, ObjectViewModel, RoutingViewModel } from "../UI/ViewModel";
import { ClusterKeyStoreComponent } from "../Views/cluster/ClusterKeyStoreComponent";
import { SoftwareUpdateComponent } from "../Views/cluster/SoftwareUpdateComponent";

const notificationSettingsViewModel: ObjectViewModel<MailerSettings, {}> = {
    type: "object",
    actions: [
        {
            type: "edit",
            propertiesSchemaName: "MailerSettings",
            requestObject: (service, _) => service.cluster.config.notifications.get(),
            updateResource: (service, _, newValue) => service.cluster.config.notifications.put(newValue)
        }
    ],
    formTitle: _ => "",
    requestObject: (service, _) => service.cluster.config.notifications.get(),
    schemaName: "MailerSettings"
};

const keyStoreViewModel: ComponentViewModel = {
    type: "component",
    component: ClusterKeyStoreComponent
};

const softwareUpdateViewModel: ComponentViewModel = {
    type: "component",
    component: SoftwareUpdateComponent
};

const clusterViewModel: MultiPageViewModel<{}> = {
    type: "multiPage",
    actions: [],
    entries: [
        {
            displayName: "",
            entries: [
                {
                    key: "notification",
                    child: notificationSettingsViewModel,
                    displayName: "Notifications",
                    icon: {
                        name: "notifications",
                        type: "material"
                    }
                },
                {
                    key: "keystore",
                    child: keyStoreViewModel,
                    displayName: "Key store",
                },
                {
                    key: "softwareUpdate",
                    child: softwareUpdateViewModel,
                    displayName: "Software update",
                    icon: {
                        name: "arrow-clockwise",
                        type: "bootstrap"
                    }
                },
            ]
        }
    ],
    formTitle: _ => "Cluster settings",
};

const root: RoutingViewModel = {
    type: "routing",
    entries: [
        {
            key: "cluster",
            viewModel: clusterViewModel,
        }
    ]
}

export default root;