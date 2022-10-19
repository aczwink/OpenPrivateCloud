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

interface UserSelectionInput
{
    userId: number | null;
    valueChanged: (newValue: number | null) => void;
}
 
@Injectable
export class UserSelectionComponent extends Component<UserSelectionInput>
{
    constructor(private apiService: APIService)
    {
        super();

        this.selectedUserName = null;
    }
    
    protected Render(): RenderValue
    {
        console.log(this.selectedUserName, this.input.userId);
        if( (this.input.userId !== null) && (this.selectedUserName === null) )
            return <ProgressSpinner />;

        return <AutoCompleteSelectBox<number>
            onChanged={newValue => this.input.valueChanged(newValue.key)}
            onLoadSuggestions={this.LoadUsers.bind(this)}
            selection={ this.input.userId === null ? null : { displayValue: this.selectedUserName!, key: this.input.userId } } />;
    }

    //Private variables
    private selectedUserName: string | null;

    //Private methods
    private async LoadUsers(searchText: string)
    {
        const users = (await this.apiService.users.get()).data;

        return users.Values().Filter(x => x.emailAddress.includes(searchText)).Map(x => ({ key: x.id, displayValue: x.emailAddress })).ToArray();
    }

    private async ReloadUserName()
    {
        this.selectedUserName = null;
        if(this.input.userId !== null)
        {
            const response = await this.apiService.users._any_.get(this.input.userId);
            if(response.statusCode === 200)
                this.selectedUserName = response.data.emailAddress;
            else
                this.input.valueChanged(null);
        }
    }

    //Event handlers
    override OnInitiated(): void
    {
        this.ReloadUserName();
    }

    override OnInputChanged(): void
    {
        this.ReloadUserName();
        this.Update();
    }
}