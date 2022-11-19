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
import { Component, FormField, Injectable, JSX_CreateElement, ProgressSpinner } from "acfrontend";
import { APIService } from "../../Services/APIService";


@Injectable
export class UserSecretComponent extends Component
{
    constructor(private apiService: APIService)
    {
        super();

        this.secret = null;
    }

    protected Render(): RenderValue
    {
        if(this.secret === null)
            return <ProgressSpinner />;

        return <fragment>
            <FormField title="Your secret">
                <input type="password" disabled value={this.secret} />
            </FormField>
            <button type="button" className="btn btn-primary" onclick={this.OnCopySecret.bind(this)}>Copy secret to clipboard</button>
            <button type="button" className="btn btn-primary" onclick={this.OnRotateSecret.bind(this)}>Rotate secret</button>
        </fragment>
    }

    //Private variables
    private secret: string | null;

    //Private methods
    private async QuerySecret()
    {
        const response = await this.apiService.user.secret.get();
        this.secret = response.data;
    }

    //Event handlers
    private OnCopySecret()
    {
        navigator.clipboard.writeText(this.secret!);
    }

    override OnInitiated(): void
    {
        this.QuerySecret();
    }

    private async OnRotateSecret()
    {
        this.secret = null;
        await this.apiService.user.secret.post();
        this.QuerySecret();
    }
}