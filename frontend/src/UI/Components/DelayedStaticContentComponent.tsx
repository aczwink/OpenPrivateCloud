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

import { Component, JSX_CreateElement, ProgressSpinner } from "acfrontend";

export class DelayedStaticContentComponent extends Component<{ contentLoader: () => Promise<RenderElement> }>
{
    constructor()
    {
        super();

        this.data = null;
        this.hasData = false;
    }
    
    protected Render(): RenderValue
    {
        if(!this.hasData)
        {
            return <fragment>
                <ProgressSpinner />
            </fragment>;
        };

        return this.data;
    }

    //Private members
    private data: any;
    private hasData: boolean;

    //Event handlers
    override async OnInitiated(): Promise<void>
    {
        this.data = this.input.contentLoader();
        this.hasData = true;
    }
}