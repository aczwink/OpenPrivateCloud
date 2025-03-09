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
import { Use } from "acfrontend";
import { APISchemaOf } from "../api-info";
import { MailerSettings } from "../../dist/api";
import { APIService } from "../services/APIService";

const notificationSettingsViewModel: RouteSetup<{}, MailerSettings> = {
    content: {
        type: "object",
        actions: [
            {
                type: "edit",
                requestObject: _ => Use(APIService).cluster.config.notifications.get(),
                schema: APISchemaOf(x => x.MailerSettings),
                updateResource: (_, newValue) => Use(APIService).cluster.config.notifications.put(newValue)
            }
        ],
        formTitle: _ => "",
        requestObject: _ => Use(APIService).cluster.config.notifications.get(),
        schema: APISchemaOf(x => x.MailerSettings)
    },
    displayText: "Notifications",
    icon: "bell",
    routingKey: "notification"
};

export const clusterRoute: RouteSetup<{}> = {
    content: {
        type: "multiPage",
        actions: [],
        entries: [
            {
                displayName: "",
                entries: [
                    notificationSettingsViewModel,
                ]
            }
        ],
        formTitle: _ => "Cluster settings",
    },
    displayText: "Cluster settings",
    icon: "gear-fill",
    requiredScopes: ["admin"],
    routingKey: "cluster",
};