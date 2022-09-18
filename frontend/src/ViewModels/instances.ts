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


import { Instance } from "../../dist/api";
import { APIService } from "../Services/APIService";
import { CollectionViewModel, MultiPageViewModel, ViewModelRoot } from "../UI/ViewModel";

const todoviewmodel: MultiPageViewModel<any, any> = {
    type: "multiPage",
    actions: [],
    entries: [],
    formTitle: () => "todo",
    service: APIService
};

const instancesViewModel: CollectionViewModel<Instance, {}, APIService> = {
    actions: [],
    child: todoviewmodel,
    displayName: "Instances",
    extractId: instance => instance.name,
    idKey: "instanceName",
    requestObjects: async service => (await service.instances.get()).data,
    schemaName: "Instance",
    service: APIService,
    type: "collection"
};

const root: ViewModelRoot = {
    key: "instances",
    viewModel: instancesViewModel,
}

export default root;