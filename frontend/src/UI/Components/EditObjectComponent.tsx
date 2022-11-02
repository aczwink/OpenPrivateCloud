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

import { Component, Injectable, JSX_CreateElement, ProgressSpinner, Router, RouterState } from "acfrontend";
import { Dictionary, OpenAPI } from "acts-util-core";
import { ResponseData } from "../../../dist/api";
import { ExtractDataFromResponseOrShowErrorMessageOnError } from "../ResponseHandler";
import { ReplaceRouteParams } from "../Shared";
import { ObjectEditorComponent } from "./ObjectEditorComponent";

interface ObjectInput<ObjectType>
{
    formTitle: (obj: any) => string;
    postUpdateUrl: string;
    requestObject: (routeParams: Dictionary<string>) => Promise<ResponseData<number, number, ObjectType>>;
    schema: OpenAPI.ObjectSchema;
    updateResource: (routeParams: Dictionary<string>, object: any) => Promise<void>;
}

@Injectable
export class EditObjectComponent<ObjectType> extends Component<ObjectInput<ObjectType>>
{
    constructor(private routerState: RouterState, private router: Router)
    {
        super();

        this.data = null;
        this.heading = "";
    }
    
    protected Render(): RenderValue
    {
        if(this.data === null)
            return <ProgressSpinner />;

        return <fragment>
            <h1>{this.heading}</h1>
            <form onsubmit={this.OnSave.bind(this)}>
                <ObjectEditorComponent object={this.data} schema={this.input.schema} />
                <button className="btn btn-primary" type="submit">Save</button>
            </form>
        </fragment>;
    }

    //Private variables
    private data: any | null;
    private heading: string;

    //Event handlers
    override async OnInitiated(): Promise<void>
    {
        const response = await this.input.requestObject(this.routerState.routeParams);
        const result = ExtractDataFromResponseOrShowErrorMessageOnError(response);
        if(result.ok)
            this.data = result.value;
        this.heading = this.input.formTitle(this.data);
    }

    private async OnSave(event: Event)
    {
        event.preventDefault();

        await this.input.updateResource(this.routerState.routeParams, this.data);

        const updateUrl = ReplaceRouteParams(this.input.postUpdateUrl, this.routerState.routeParams)
        this.router.RouteTo(updateUrl);
    }
}