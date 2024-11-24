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

import { RouteSetup } from "acfrontendex";
import { ChangeUserPasswordComponent } from "../components/user-settings/ChangeUserPasswordComponent";
import { UserSecretComponent } from "../components/user-settings/UserSecretComponent";
import { AuthGuard } from "../AuthGuard";
import { ClusterLockedGuard } from "../ClusterLockedGuard";

export const userSettingsViewModel: RouteSetup = {
    content: {
        type: "multiPage",
        actions: [],
        entries: [
            {
                displayName: "",
                entries: [
                    {
                        content: {
                            type: "component",
                            component: UserSecretComponent
                        },
                        displayText: "Wallet",
                        icon: "wallet",
                        routingKey: "wallet",
                    },
                    {
                        content: {
                            type: "component",
                            component: ChangeUserPasswordComponent
                        },
                        displayText: "Change password",
                        icon: "key",
                        routingKey: "pw",
                    }
                ]
            }
        ],
        formTitle: _ => "User settings",
    },
    displayText: "User settings",
    guards: [ClusterLockedGuard, AuthGuard],
    icon: "person",
    routingKey: "usersettings",
};