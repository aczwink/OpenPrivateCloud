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

import { Anchor, BootstrapIcon, Component, Injectable, JSX_CreateElement, MatIcon, PopupManager, ProgressSpinner, RouterButton, RouterState } from "acfrontend";
import { Dictionary, EqualsAny, OpenAPI } from "acts-util-core";
import { ResponseData } from "../../../dist/api";
import { APIService } from "../../Services/APIService";
import { IdBoundResourceAction } from "../IdBoundActions";
import { DeleteAction, EditAction, ObjectBoundAction } from "../ObjectBoundActions";
import { ExtractDataFromResponseOrShowErrorMessageOnError, ShowErrorMessageOnErrorFromResponse } from "../ResponseHandler";
import { ReplaceRouteParams } from "../Shared";
import { UnboundResourceAction } from "../UnboundActions";
import { RenderReadOnlyValue, RenderTitle } from "../ValuePresentation";
import { ObjectEditorComponent } from "./ObjectEditorComponent";
import { APISchemaService } from "../../Services/APISchemaService";
import { RenderInfo } from "../ViewModel";

interface ObjectListInput<ObjectType>
{
    baseUrl: string;
    elementSchema: OpenAPI.ObjectSchema;
    extractId: (object: any) => number | string;
    hasChild: boolean;
    heading: string;
    idBoundActions: IdBoundResourceAction<any, any, any>[];
    objectBoundActions: ObjectBoundAction<any, any>[];
    renderInfo: RenderInfo<any, any>;
    requestObjects: (routeParams: Dictionary<string>) => Promise<ResponseData<number, number, ObjectType[]>>;
    unboundActions: UnboundResourceAction<any, any>[];
}

@Injectable
export class ObjectListComponent<ObjectType> extends Component<ObjectListInput<ObjectType>>
{
    constructor(private routerState: RouterState, private apiService: APIService, private popupManager: PopupManager, private apiSchemaService: APISchemaService)
    {
        super();

        this.data = null;
        this.sortKey = "";
        this.sortAscending = false;
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
                        {(this.input.idBoundActions.length + this.input.objectBoundActions.length) == 0 ? null : <th>Actions</th>}
                    </tr>
                </thead>
                <tbody>{this.data.map(this.RenderObjectRow.bind(this))}</tbody>
            </table>
            {this.input.unboundActions.map(this.RenderUnboundAction.bind(this))}
        </fragment>;
    }

    //Private state
    private data: ObjectType[] | null;
    private sortKey: string | number;
    private sortAscending: boolean;

    //Private methods
    private ExtractId(object: any)
    {
        return this.input.extractId(object);
    }

    private GetPropertyOrder()
    {
        const props = this.input.elementSchema.properties.OwnKeys().ToArray();
        const order = this.input.renderInfo.order ?? [];

        const tail = props.Values().Filter(x => !order.includes(x));
        return order.concat(tail.ToArray());
    }

    private OrderByDirection(v1: any, v2: any, ascending: boolean)
    {
        if(ascending)
            return this.OrderValue(v1, v2);
        return this.OrderValue(v2, v1);
    }

    private OrderValue(v1: any, v2: any)
    {
        if(typeof v1 === "number")
            return v1 - v2;
        return v1.toString().localeCompare(v2);
    }

    private async QueryData()
    {
        const response = await this.input.requestObjects(this.routerState.routeParams);
        const result = await ExtractDataFromResponseOrShowErrorMessageOnError(response);
        if(result.ok)
        {
            this.data = result.value;
            const firstColumnKey = this.input.elementSchema.required[0];
            this.Sort(firstColumnKey, true);
        }
    }

    private RenderColumnName(key: string)
    {
        const props = this.input.renderInfo.properties ?? {};
        const title = props[key]?.title ?? RenderTitle(this.input.elementSchema.properties[key]!, key.toString());

        let sortIndicator = null;
        if(this.sortKey === key)
        {
            const content = "caret-" + (this.sortAscending ? "down" : "up") + "-fill";
            sortIndicator = <BootstrapIcon>{content}</BootstrapIcon>;
        }

        return <th onclick={this.OnColumnHeaderClick.bind(this, key)} style="cursor: pointer;">{title} {sortIndicator}</th>;
    }

    private RenderColumnsNames()
    {
        const order = this.GetPropertyOrder();
        return order.map(x => this.RenderColumnName(x.toString()));
    }

    private RenderIdBoundAction(object: any, action: IdBoundResourceAction<any, any, any>)
    {
        const route = this.input.baseUrl + "/" + encodeURIComponent(this.ExtractId(object)) + "/" + action.type;
        switch(action.type)
        {
            case "delete":
                return <Anchor className="link-danger" route={this.ReplaceRouteParams(route)}><MatIcon>delete_forever</MatIcon></Anchor>;
        }
        return null;
    }

    private RenderObjectActions(object: any)
    {
        if((this.input.idBoundActions.length + this.input.objectBoundActions.length) == 0)
            return null;

        return <td>
            {...this.input.objectBoundActions.map(this.RenderObjectBoundAction.bind(this, object))}
            {...this.input.idBoundActions.map(this.RenderIdBoundAction.bind(this, object))}
        </td>;
    }

    private RenderObjectBoundAction(object: any, action: ObjectBoundAction<any, any>)
    {
        switch(action.type)
        {
            case "custom":
                return <a role="button" onclick={() => action.action(this.apiService, this.routerState.routeParams, object)}><MatIcon>{action.matIcon}</MatIcon></a>;

            case "edit":
                return <a className="link-primary" role="button" onclick={this.OnEdit.bind(this, action, object)}><MatIcon>edit</MatIcon></a>;

            case "delete":
                return <a className="link-danger" role="button" onclick={this.OnDelete.bind(this, action, object)}><MatIcon>delete_forever</MatIcon></a>;
        }
        return null;
    }

    private RenderObjectProperty(obj: any, key: string)
    {
        const props = this.input.renderInfo.properties ?? {};
        const customRender = props[key]?.render;
        if(customRender !== undefined)
            return customRender(obj, this.routerState.routeParams);
        return RenderReadOnlyValue(obj[key], this.input.elementSchema.properties[key]!);
    }

    private RenderObjectPropertyEntry(obj: any, key: string, idx: number, isRequired: boolean)
    {
        const isIdColumn = (key === this.input.renderInfo.id) || ((idx === 0) && this.input.hasChild);
        if(isIdColumn)
        {
            const id = this.ExtractId(obj);
            const route = this.ReplaceRouteParams(this.input.baseUrl + "/" + encodeURIComponent(id));
            return <Anchor route={route}>{this.RenderObjectProperty(obj, key)}</Anchor>;
        }

        if(!isRequired && (obj[key] === undefined))
            return <i>undefined</i>;

        return this.RenderObjectProperty(obj, key);
    }

    private RenderObjectRow(obj: any)
    {
        const order = this.GetPropertyOrder();
        let entries = order.map( (k, i) => <td>{this.RenderObjectPropertyEntry(obj, k.toString(), i, this.input.elementSchema.required.Contains(k))}</td>);
        return <tr>{...entries.concat(this.RenderObjectActions(obj))}</tr>;
    }

    private RenderUnboundAction(action: UnboundResourceAction<any, any>)
    {
        const route = this.input.baseUrl + "/" + action.type;
        switch(action.type)
        {
            case "create":
                return <RouterButton color="primary" route={this.ReplaceRouteParams(route)}><BootstrapIcon>plus</BootstrapIcon></RouterButton>;
        }
    }

    private ReplaceRouteParams(route: string)
    {
        return ReplaceRouteParams(route, this.routerState.routeParams);
    }

    private Sort(columnKey: string | number, ascending: boolean)
    {
        this.sortKey = columnKey;
        this.sortAscending = ascending;

        this.data!.sort((a, b) => this.OrderByDirection((a as any)[columnKey], (b as any)[columnKey], ascending));
    }

    //Event handlers
    private OnColumnHeaderClick(columnKey: string | number)
    {
        const asc = (columnKey === this.sortKey) ? !this.sortAscending : true;
        this.Sort(columnKey, asc);
        this.Update();
    }
    
    private async OnDelete(action: DeleteAction<any, any>, object: any)
    {
        if(confirm("Are you sure that you want to delete this?"))
        {
            this.data = null;
            const response = await action.deleteResource(this.apiService, this.routerState.routeParams, object);
            ShowErrorMessageOnErrorFromResponse(response);
            this.QueryData();
        }
    }

    private OnEdit(action: EditAction<any, any>, object: object)
    {
        const index = this.data!.findIndex(x => EqualsAny(x, object));
        const clone = object.DeepClone();
        const schema = this.apiSchemaService.GetSchema(action.schemaName);
        const ref = this.popupManager.OpenDialog(<ObjectEditorComponent object={clone} schema={schema} />, { title: "Edit" });
        ref.onAccept.Subscribe( async () => {
            this.data = null;
            ref.Close();

            await action.updateResource(this.apiService, this.routerState.routeParams, clone, object, index);

            this.QueryData();
        });
    }

    public override OnInitiated()
    {
        this.QueryData();
    }
}