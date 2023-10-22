/**
 * OpenPrivateCloud
 * Copyright (C) 2023 Amir Czwink (amir130@hotmail.de)
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

import { Component, FileDownloadService, Injectable, JSX_CreateElement } from "acfrontend";
import { APIService } from "../../Services/APIService";

@Injectable
export class ClusterKeyStoreComponent extends Component
{
    constructor(private apiService: APIService, private fileDownloadService: FileDownloadService)
    {
        super();
    }

    protected Render(): RenderValue
    {
        return <fragment>
            <button type="button" onclick={this.OnDownloadMasterKey.bind(this)}>Download master key</button>
            <button type="button" onclick={this.OnRotateMasterKey.bind(this)}>Rotate master key</button>
        </fragment>;
    }

    //Event handlers
    private async OnDownloadMasterKey()
    {
        const response = await this.apiService.cluster.keystore.get();
        if(response.statusCode === 409)
            alert("Cluster key store is locked");
        else
        {
            this.fileDownloadService.DownloadBlobAsFile(new Blob([response.data], { type: "application/json" }), "masterkey.json");
        }
    }

    private async OnRotateMasterKey()
    {
        if(confirm("Are you sure? Make sure to backup first!"))
            await this.apiService.cluster.keystore.put();
    }
}