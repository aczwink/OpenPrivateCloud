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

import { PublicUserData, UserCreationData } from "../../dist/api";
import { APIService } from "../Services/APIService";
import { CollectionViewModel, ComponentViewModel, MultiPageViewModel, RoutingViewModel } from "../UI/ViewModel";
import { FileManagerComponent } from "../Views/file-manager/FileManagerComponent";

const asduserViewModel: ComponentViewModel = {
    type: "component",
    component: FileManagerComponent,
};

const userViewModel: MultiPageViewModel<{ userEmailAddress: string }, APIService> = {
    type: "multiPage",
    actions: [],
    formTitle: ids => ids.userEmailAddress,
    entries: [],
    service: APIService,
};

const usersViewModel: CollectionViewModel<PublicUserData, {}, APIService, UserCreationData> = {
    actions: [
        {
            type: "create",
            createResource: async (service, _ids, props) => {
                await service.users.post(props);
            },
            schemaName: "UserCreationData"
        }
    ],
    child: userViewModel,
    displayName: "Users",
    extractId: user => user.emailAddress,
    idKey: "userEmailAddress",
    requestObjects: async service => (await service.users.get()).data,
    schemaName: "PublicUserData",
    service: APIService,
    type: "collection"
};

const root: RoutingViewModel = {
    type: "routing",
    entries: [
        {
            key: "users",
            viewModel: usersViewModel,
        }
    ]
}

export default root;