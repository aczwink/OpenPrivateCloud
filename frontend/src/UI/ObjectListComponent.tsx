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

import { Anchor, BootstrapIcon, Component, Injectable, JSX_CreateElement, MatIcon, ProgressSpinner, RouterButton, RouterState } from "acfrontend";
import { Dictionary, OpenAPI } from "acts-util-core";
import { BoundResourceAction } from "./BoundActions";
import { UnboundResourceAction } from "./UnboundActions";
import { RenderReadOnlyValue, RenderTitle } from "./ValuePresentation";

interface ObjectListInput
{
    actions: BoundResourceAction<any, any>[];
    baseUrl: string;
    elementSchema: OpenAPI.ObjectSchema;
    extractId: (object: any) => string;
    heading: string;
    requestObjects: (routeParams: Dictionary<string>) => Promise<any[]>;
    unboundActions: UnboundResourceAction<any, any, any, any>[];
}

@Injectable
export class ObjectListComponent extends Component<ObjectListInput>
{
    constructor(private routerState: RouterState)
    {
        super();

        this.data = null;
    }

    protected Render(): RenderValue
    {
        if(this.data === null)
            return <ProgressSpinner />;

        return <fragment>
            <h1>{this.input.heading}</h1>
            <table className="table table-hover">
                <thead>
                    <tr>
                        {...this.RenderColumnsNames()}
                        {this.input.actions.length == 0 ? null : <th>Actions</th>}
                    </tr>
                </thead>
                <tbody>{this.data.map(this.RenderObjectRow.bind(this))}</tbody>
            </table>
            {this.input.unboundActions.map(this.RenderUnboundAction.bind(this))}
        </fragment>;
    }

    //Private variables
    private data: any[] | null;

    //Private methods
    private ExtractId(object: any)
    {
        return this.input.extractId(object);
    }

    private ReplaceRouteParams(route: string)
    {
        return RouterState.ReplaceRouteParams(route, this.routerState.routeParams).join("/");
    }

    private async QueryData()
    {
        this.data = await this.input.requestObjects(this.routerState.routeParams);
        const firstColumnKey = this.input.elementSchema.properties.OwnKeys().First();
        this.data.sort((a, b) => a[firstColumnKey].localeCompare(b[firstColumnKey]));
    }

    private RenderAction(object: any, action: BoundResourceAction<any, any>)
    {
        const route = this.input.baseUrl + "/" + encodeURIComponent(this.ExtractId(object)) + "/" + action.type;
        switch(action.type)
        {
            case "delete":
                return <Anchor class="link-danger" route={this.ReplaceRouteParams(route)}><MatIcon>delete_forever</MatIcon></Anchor>;
        }
        return null;
    }

    private RenderActions(object: any)
    {
        if(this.input.actions.length == 0)
            return null;

        return <td>{...this.input.actions.map(this.RenderAction.bind(this, object))}</td>;
    }

    private RenderColumnsNames()
    {
        return this.input.elementSchema.properties.OwnKeys().Map(x => <th>{RenderTitle(this.input.elementSchema.properties[x]!, x.toString())}</th>).ToArray();
    }

    private RenderObjectProperty(obj: any, key: string)
    {
        return RenderReadOnlyValue(obj[key], this.input.elementSchema.properties[key]! as any);
    }

    private RenderObjectPropertyEntry(obj: any, key: string, idx: number)
    {
        if(idx === 0)
        {
            const route = this.ReplaceRouteParams(this.input.baseUrl + "/" + encodeURIComponent(this.ExtractId(obj)));
            return <Anchor route={route}>{this.RenderObjectProperty(obj, key)}</Anchor>;
        }
        return this.RenderObjectProperty(obj, key);
    }

    private RenderObjectRow(obj: any)
    {
        let entries = this.input.elementSchema.properties.OwnKeys().ToArray().map( (k, i) => <td>{this.RenderObjectPropertyEntry(obj, k.toString(), i)}</td>);
        return <tr>{...entries.concat(this.RenderActions(obj))}</tr>;
    }

    private RenderUnboundAction(action: UnboundResourceAction<any, any, any, any>)
    {
        const route = this.input.baseUrl + "/" + action.type;
        switch(action.type)
        {
            case "create":
                return <RouterButton className="btn btn-primary" route={this.ReplaceRouteParams(route)}><BootstrapIcon>plus</BootstrapIcon></RouterButton>;
        }
    }

    //Event handlers
    public override OnInitiated()
    {
        this.QueryData();
    }
}