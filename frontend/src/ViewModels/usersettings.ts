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

import { MultiPageViewModel, RoutingViewModel } from "../UI/ViewModel";
import { ChangeUserPasswordComponent } from "../Views/user-settings/ChangeUserPasswordComponent";
import { UserSecretComponent } from "../Views/user-settings/UserSecretComponent";

const userSettingsViewModel: MultiPageViewModel<{}> = {
    type: "multiPage",
    actions: [],
    entries: [
        {
            key: "secret",
            child: {
                type: "component",
                component: UserSecretComponent,
            },
            displayName: "Secret"
        },
        {
            key: "pw",
            child: {
                type: "component",
                component: ChangeUserPasswordComponent
            },
            displayName: "Change password"
        }
    ],
    formTitle: _ => "User settings",
};
 
const root: RoutingViewModel = {
    type: "routing",
    entries: [
        {
            key: "usersettings",
            viewModel: userSettingsViewModel,
        }
    ]
}

export default root;