/**
 * OpenPrivateCloud
 * Copyright (C) 2024 Amir Czwink (amir130@hotmail.de)
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
export class SoftwareUpdateComponent extends Component
{
    constructor(private apiService: APIService)
    {
        super();
    }

    protected Render(): RenderValue
    {
        return <fragment>
            <button type="button" onclick={this.OnInitiateUpdate.bind(this)}>Update OpenPrivateCloud software</button>
        </fragment>;
    }

    //Event handlers
    private async OnInitiateUpdate()
    {
        if(confirm("Are you sure? This will impose a down time on the controller node"))
        {
            alert("Starting update. You will be logged out as soon as the controller is down");
            await this.apiService.cluster.update.put();
            window.location.reload();
        }
    }
}