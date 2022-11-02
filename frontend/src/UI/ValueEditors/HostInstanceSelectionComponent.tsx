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

import { AutoCompleteSelectBox, Component, Injectable, JSX_CreateElement, ProgressSpinner } from "acfrontend";
import { APIService } from "../../Services/APIService";

interface HostInstanceSelection
{
    type: string;
    hostName: string;
    value: string | null;
    valueChanged: (newValue: string | null) => void;
}
  
@Injectable
export class HostInstanceSelectionComponent extends Component<HostInstanceSelection>
{
    constructor(private apiService: APIService)
    {
        super();
        this.state = null;
    }

    protected Render(): RenderValue
    {
        if( this.state === null )
            return <ProgressSpinner />;

        return <AutoCompleteSelectBox<string>
            onChanged={newValue => this.input.valueChanged(newValue.key)}
            onLoadSuggestions={this.LoadInstances.bind(this)}
            selection={{ key: this.state, displayValue: this.state }} />;
    }

    //Private variables
    private state: string | null;

    //Private methods
    private async CheckWhetherValueExist()
    {
        if(this.input.value === null)
            this.state = null;
        else if(this.input.value !== this.state)
        {
            this.state = null;

            const response = await this.apiService.instances.search.get({
                hostName: this.input.hostName,
                instanceNameFilter: this.input.value,
                type: this.input.type
            });
            if(response.statusCode === 200)
                this.state = this.input.value;
            else
                this.input.valueChanged(null);
        }
    }

    private async LoadInstances(searchText: string)
    {
        searchText = searchText.toLowerCase();

        const response = await this.apiService.instances.search.get({
            hostName: this.input.hostName,
            instanceNameFilter: searchText,
            type: this.input.type
        });
        return response.data.map(x => ({
            key: x.fullName,
            displayValue: x.fullName,
        }));
    }

    //Event handlers
    override OnInitiated(): void
    {
        this.CheckWhetherValueExist();
    }

    override OnInputChanged(): void
    {
        this.CheckWhetherValueExist();
        this.Update();
    }
}