/**
 * OpenPrivateCloud
 * Copyright (C) 2019-2024 Amir Czwink (amir130@hotmail.de)
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
import { Component, Injectable, JSX_CreateElement, Router } from "acfrontend";
import { OpenAPISchemaValidator } from "acts-util-core";
import { AnyResourceProperties } from "../../../dist/api";
import { NamedSchemaRegistry, ObjectEditorComponent } from "acfrontendex";
import { APIService } from "../../services/APIService";
import { ObjectEditorContext } from "acfrontendex/dist/components/ObjectEditorComponent";

  
   
@Injectable
export class CreateResourceComponent extends Component
{
    constructor(private apiSchemaService: NamedSchemaRegistry, private router: Router, private apiService: APIService)
    {
        super();

        const schema = this.apiSchemaService.GetSchema("AnyResourceProperties");

        this.context = {
            hostName: ""
        };
        this.data = apiSchemaService.CreateDefault(schema);
        this.isValid = false;
    }

    protected Render(): RenderValue
    {
        const schema = this.apiSchemaService.GetSchema("AnyResourceProperties");

        return <fragment>
            <h1>{"Create instance"}</h1>
            <form onsubmit={this.OnSave.bind(this)}>
                <ObjectEditorComponent context={this.context} object={this.data} schema={schema} onObjectUpdated={this.OnObjectUpdated.bind(this)} />
                <button disabled={!this.isValid} className="btn btn-primary" type="submit">Create</button>
            </form>
        </fragment>;
    }

    //Private variables
    private context: ObjectEditorContext;
    private data: AnyResourceProperties;
    private isValid: boolean;

    //Event handlers
    private OnObjectUpdated(newValue: AnyResourceProperties)
    {
        this.data = newValue;

        const schema = this.apiSchemaService.GetSchema("AnyResourceProperties");
        
        const validator = new OpenAPISchemaValidator(this.apiSchemaService.root);
        this.isValid = validator.Validate(this.data, schema);

        this.context = {
            hostName: newValue.hostName
        };
    }

    private async OnSave(event: Event)
    {
        event.preventDefault();

        const rgName = this.router.state.Get().routeParams.resourceGroupName!;
        await this.apiService.resourceGroups._any_.resources.post(rgName, this.data);
        this.router.RouteTo("/resourcegroups/" + rgName);
    }
}