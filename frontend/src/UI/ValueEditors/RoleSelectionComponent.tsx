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
import { APIService } from "../../Services/APIService";

interface RoleSelectionInput
{
    roleId: string | null;
    valueChanged: (newValue: string | null) => void;
}

@Injectable
export class RoleSelectionComponent extends Component<RoleSelectionInput>
{
    constructor(private apiService: APIService)
    {
        super();

        this.selection = null;
    }
    
    protected Render(): RenderValue
    {
        if( (this.input.roleId !== null) && (this.selection === null) )
            return <ProgressSpinner />;

        return <AutoCompleteSelectBox<string>
            onChanged={newValue => this.input.valueChanged(newValue.key)}
            onLoadSuggestions={this.LoadRoles.bind(this)}
            selection={ this.selection } />;
    }

    //Private variables
    private selection: KeyDisplayValuePair<string> | null;

    //Private methods
    private async LoadRoles(searchText: string)
    {
        const roles = (await this.apiService.roles.get({ filter: searchText })).data;

        return roles.map(x => ({ key: x.id, displayValue: x.name }));
    }

    private async ReloadRoleName()
    {
        if(this.input.roleId === null)
            this.selection = null;
        else if(this.input.roleId !== this.selection?.key)
        {
            const response = await this.apiService.roles._any_.get(this.input.roleId);
            if(response.statusCode === 200)
            {
                this.selection = {
                    displayValue: response.data.name,
                    key: this.input.roleId
                };
            }
            else
                this.input.valueChanged(null);
        }
    }

    //Event handlers
    override OnInitiated(): void
    {
        this.ReloadRoleName();
    }

    override OnInputChanged(): void
    {
        this.ReloadRoleName();
        this.Update();
    }
}