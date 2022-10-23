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
import { Dictionary, OpenAPI, OpenAPISchemaValidator } from "acts-util-core";
import { APISchemaService } from "../../Services/APISchemaService";
import { ObjectEditorComponent } from "./ObjectEditorComponent";

interface AddObjectInput
{
    createResource: (routeParams: Dictionary<string>, data: any) => Promise<void>;
    heading: string;
    postUpdateUrl: string;
    schema: OpenAPI.ObjectSchema;
}

@Injectable
export class AddObjectComponent extends Component<AddObjectInput>
{
    constructor(private router: Router, private routerState: RouterState, private apiSchemaService: APISchemaService)
    {
        super();

        this.isValid = false;
        this.loading = false;
    }
    
    protected Render(): RenderValue
    {
        if(this.loading)
        {
            return <fragment>
                <ProgressSpinner />
                Standby...
            </fragment>;
        };

        return <fragment>
            <h1>{this.input.heading + " | Create"}</h1>
            <form onsubmit={this.OnSave.bind(this)}>
                <ObjectEditorComponent object={this.data} schema={this.input.schema} onObjectUpdated={this.OnObjectUpdated.bind(this)} />
                <button disabled={!this.isValid} className="btn btn-primary" type="submit">Save</button>
            </form>
        </fragment>;
    }

    //Private members
    private data: any;
    private isValid: boolean;
    private loading: boolean;

    //Event handlers
    override OnInitiated(): void
    {
        this.data = this.apiSchemaService.CreateDefault(this.input.schema);
        this.OnObjectUpdated();
    }

    private OnObjectUpdated()
    {
        const validator = new OpenAPISchemaValidator(this.apiSchemaService.root);
        this.isValid = validator.Validate(this.data, this.input.schema);
    }

    private async OnSave(event: Event)
    {
        event.preventDefault();
        this.loading = true;

        await this.input.createResource(this.routerState.routeParams, this.data);
        const route = RouterState.ReplaceRouteParams(this.input.postUpdateUrl, this.routerState.routeParams).join("/");
        this.router.RouteTo(route);
    }
}