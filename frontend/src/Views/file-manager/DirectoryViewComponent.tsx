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

import { Component, Injectable, JSX_CreateElement } from "acfrontend";
import { APIService } from "../../Services/APIService";

@Injectable
export class DirectoryViewComponent extends Component<{ instanceName: string }>
{
    constructor(private apiService: APIService)
    {
        super();

        this.dirPath = "/";
    }
    
    protected Render(): RenderValue
    {
        return <fragment>
            <h2>{this.dirPath}</h2>
        </fragment>;
    }

    //Private variables
    private dirPath: string;

    //Private methods
    private async QueryEntries(path: string)
    {
        const result = await this.apiService.resourceProviders.fileservices.filestorage._any_.get(this.input.instanceName, { dirPath: path });
        if(result.statusCode === 200)
        {
            console.log(result.data);
            alert("OK IMPLEMENT ME");
        }
        else
            throw new Error("NOT IMPLEMENTED");
    }

    //Event handlers
    public override OnInitiated()
    {
        this.QueryEntries(this.dirPath);
    }
}