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
import { AutoCompleteSelectBox, Component, Injectable, JSX_CreateElement, KeyDisplayValuePair, ProgressSpinner } from "acfrontend";
import { APIService } from "../Services/APIService";

interface UserGroupSelectionInput
{
    userGroupId: number | null;
    valueChanged: (newValue: number | null) => void;
}

@Injectable
export class UserGroupSelectionComponent extends Component<UserGroupSelectionInput>
{
    constructor(private apiService: APIService)
    {
        super();

        this.selection = null;
    }
    
    protected Render(): RenderValue
    {
        if( (this.input.userGroupId !== null) && (this.selection === null) )
            return <ProgressSpinner />;

        return <AutoCompleteSelectBox<number>
            onChanged={newValue => this.input.valueChanged(newValue.key)}
            onLoadSuggestions={this.LoadUserGroups.bind(this)}
            selection={ this.selection } />;
    }

    //Private variables
    private selection: KeyDisplayValuePair<number> | null;

    //Private methods
    private async LoadUserGroups(searchText: string)
    {
        const users = (await this.apiService.usergroups.get()).data;

        searchText = searchText.toLowerCase();
        return users.Values().Filter(x => x.name.toLowerCase().includes(searchText)).Map(x => ({ key: x.id, displayValue: x.name })).ToArray();
    }

    private async ReloadGroupName()
    {
        if(this.input.userGroupId === null)
            this.selection = null;
        else if(this.input.userGroupId !== this.selection?.key)
        {
            const response = await this.apiService.usergroups._any_.get(this.input.userGroupId);
            if(response.statusCode === 200)
            {
                this.selection = {
                    displayValue: response.data.name,
                    key: this.input.userGroupId
                };
            }
            else
                this.input.valueChanged(null);
        }
    }

    //Event handlers
    override OnInitiated(): void
    {
        this.ReloadGroupName();
    }

    override OnInputChanged(): void
    {
        this.ReloadGroupName();
        this.Update();
    }
}