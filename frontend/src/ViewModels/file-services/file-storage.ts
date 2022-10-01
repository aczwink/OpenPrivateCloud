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

import { APIService } from "../../Services/APIService";
import { ComponentViewModel, MultiPageViewModel } from "../../UI/ViewModel";
import { FileManagerComponent } from "../../Views/file-manager/FileManagerComponent";

export const fileManagerViewModel: ComponentViewModel = {
    type: "component",
    component: FileManagerComponent
};

export const fileStorageViewModel: MultiPageViewModel<{ instanceName: string }, APIService> = {
    actions: [],
    entries: [
        {
            key: "file-manager",
            child: fileManagerViewModel,
            displayName: "File manager"
        },
        {
            key: "smb-settings",
            child: fileManagerViewModel,
            displayName: "SMB configuration"
        }
    ],
    formTitle: ids => ids.instanceName,
    service: APIService,
    type: "multiPage"
};