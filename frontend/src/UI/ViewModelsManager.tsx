/**
 * OpenPrivateCloud
 * Copyright (C) 2019-2023 Amir Czwink (amir130@hotmail.de)
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

import { Injectable, JSX_CreateElement, RootInjector, Route } from "acfrontend";
import { OpenAPI } from "acts-util-core";
import { AuthGuard } from "../AuthGuard";
import { APISchemaService } from "../Services/APISchemaService";
import { APIService } from "../Services/APIService";
import { AddObjectComponent } from "./Components/AddObjectComponent";
import { IdBoundResourceAction } from "./IdBoundActions";
import { DeleteObjectComponent } from "./Components/DeleteObjectComponent";
import { EditObjectComponent } from "./Components/EditObjectComponent";
import { ListViewModel } from "./ListViewModel";
import { ObjectListComponent } from "./Components/ObjectListComponent";
import { SideNavComponent } from "./Components/SideNavComponent";
import { UnboundResourceAction } from "./UnboundActions";
import { CollectionViewModel, MultiPageViewModel, ObjectViewModel, ViewModel, RoutingViewModel, ComponentViewModel } from "./ViewModel";
import { ViewObjectComponent } from "./Components/ViewObjectComponent";

class PathTraceNode
{
    constructor()
    {
        this.segment = "";
        this._parent = null;
    }

    //Properties
    public get parent(): PathTraceNode
    {
        if(this._parent === null)
            return this;
        return this._parent;
    }

    public get path(): string
    {
        if(this._parent === null)
            return "/";
        return this.JoinRoute(this._parent.path, this.segment);
    }

    //Public methods
    public CreateChild(segment: string)
    {
        const child = new PathTraceNode;
        child.segment = segment;
        child._parent = this;

        return child;
    }

    //Private state
    private segment: string;
    private _parent: PathTraceNode | null;

    //Private methods
    private JoinRoute(base: string, segmentToAdd: string)
    {
        if(base === "/")
            return base + segmentToAdd;
        return base + "/" + segmentToAdd;
    }
}

@Injectable
export class ViewModelsManager
{
    constructor(private apiSchemaService: APISchemaService)
    {
        this.viewModelsRoots = [];
    }

    //Public methods
    public BuildRoutes()
    {
        return this.viewModelsRoots.map(x => this.BuildRoutingViewModelRoutes(x, new PathTraceNode));
    }

    public Register(viewModelRoot: RoutingViewModel)
    {
        this.viewModelsRoots.push(viewModelRoot);
    }

    //Private variables
    private viewModelsRoots: RoutingViewModel[];

    //Private methods
    private BuildBoundActionComponent(action: IdBoundResourceAction<any, any, any>, formTitle: (ids: any) => string, parentNode: PathTraceNode)
    {
        switch(action.type)
        {
            case "delete":
                return <DeleteObjectComponent
                    deleteResource={ids => action.deleteResource(RootInjector.Resolve(APIService), ids)}
                    postDeleteUrl={parentNode.parent.path}
                    />;
            case "edit":
                return <EditObjectComponent
                    formTitle={formTitle}
                    postUpdateUrl={parentNode.path}
                    requestObject={async ids => (await action.requestObject(RootInjector.Resolve(APIService), ids))}
                    updateResource={(ids, obj) => action.updateResource(RootInjector.Resolve(APIService), ids, obj)}
                    schema={this.apiSchemaService.GetSchema(action.propertiesSchemaName) as OpenAPI.ObjectSchema}
                    loadContext={(action.loadContext === undefined) ? undefined : (ids => action.loadContext!(RootInjector.Resolve(APIService), ids))}
                    />;
        }
    }

    private BuildBoundActionRoute(action: IdBoundResourceAction<any, any, any>, formTitle: (ids: any) => string, parentNode: PathTraceNode): Route
    {
        return {
            component: this.BuildBoundActionComponent(action, formTitle, parentNode),
            path: action.type
        };
    }

    private BuildCollectionViewModelRoutes(viewModel: CollectionViewModel<any, any, any>, parentNode: PathTraceNode): Route
    {
        const schema = this.apiSchemaService.GetSchema(viewModel.schemaName) as OpenAPI.ObjectSchema;
        //const columnsSet = ["name"].concat(resource.overviewProperties as string[]).Values().ToSet();
        const columnsSet = schema.properties.Entries().Map(kv => kv.key).ToSet();

        const mappedSchema: OpenAPI.ObjectSchema = {
            type: "object",
            additionalProperties: schema.additionalProperties,
            properties: schema.properties.Entries().Filter(kv => columnsSet.has(kv.key.toString())).ToDictionary(kv => kv.key, kv => kv.value!),
            required: schema.required,
            description: schema.description,
            title: schema.title,
        };

        const children = viewModel.child.type === "routing"
            ? (viewModel.child.entries.map(x => ({
                children: [this.BuildViewModelRoutes(x.viewModel, parentNode.CreateChild(x.key))],
                path: x.key
            })))
            : ([{
                children: [this.BuildViewModelRoutes(viewModel.child, parentNode.CreateChild(":" + viewModel.idKey))],
                path: ":" + viewModel.idKey,
            }]);

        return {
            children: [
                ...viewModel.actions.map(action => this.BuildUnboundResourceActionRoutes(viewModel.displayName, viewModel.schemaName, action, parentNode)),
                ...children,
                {
                    component: <ObjectListComponent
                        idBoundActions={this.FindActions(viewModel.child)}
                        baseUrl={parentNode.path}
                        elementSchema={mappedSchema}
                        extractId={viewModel.extractId}
                        hasChild={true}
                        heading={viewModel.displayName}
                        objectBoundActions={[]}
                        requestObjects={ids => viewModel.requestObjects(RootInjector.Resolve(APIService), ids)}
                        unboundActions={viewModel.actions}
                    />,
                    path: "",
                }
            ],
            guards: [AuthGuard],
            path: "",
        };
    }

    private BuildComponentViewModelRoutes(viewModel: ComponentViewModel): Route
    {
        return {
            component: viewModel.component,
            guards: [AuthGuard],
            path: "",
        }
    }

    private BuildListViewModelRoutes(viewModel: ListViewModel<any, any>, parentNode: PathTraceNode): Route
    {
        const schema = this.apiSchemaService.GetSchema(viewModel.schemaName) as OpenAPI.ObjectSchema;

        return {
            children: [
                ...viewModel.actions.map(action => this.BuildUnboundResourceActionRoutes(viewModel.displayName, viewModel.schemaName, action, parentNode)),
                {
                    component: <ObjectListComponent
                        idBoundActions={[]}
                        baseUrl={parentNode.path}
                        elementSchema={schema}
                        extractId={_ => 0}
                        hasChild={false}
                        heading={viewModel.displayName}
                        objectBoundActions={viewModel.boundActions}
                        requestObjects={ids => viewModel.requestObjects(RootInjector.Resolve(APIService), ids)}
                        unboundActions={viewModel.actions}
                        />,
                    path: "",
                }
            ],
            guards: [AuthGuard],
            path: "",
        };
    }

    private BuildMultiPageViewModelRoutes(viewModel: MultiPageViewModel<any>, parentNode: PathTraceNode): Route
    {
        if(viewModel.entries.length === 0)
        {
            return {
                path: "",
            };
        }

        const cats = viewModel.entries.map(x => (
            {
                catName: x.displayName,
                objectTypes: x.entries.map(y => (
                    {
                        key: y.key,
                        displayName: y.displayName,
                        icon: y.icon
                    }
                ))
            }
        ));

        return {
            children: [
                ...viewModel.actions.map(action => this.BuildBoundActionRoute(action, viewModel.formTitle, parentNode)),
                ...viewModel.entries.Values().Map(x => x.entries.Values()).Flatten().Map(x => {
                    const childRoute = this.BuildViewModelRoutes(x.child, parentNode.CreateChild(x.key));
                
                    return {
                        path: (childRoute.path === "" ? x.key : (x.key + "/" + childRoute.path)),
                        children: childRoute.children,
                        component: childRoute.component,
                    };
                }).ToArray(),
                {
                    path: "",
                    redirect: viewModel.entries[0].entries[0].key
                }
            ],
            component: <SideNavComponent actions={viewModel.actions} baseRoute={parentNode.path} formHeading={viewModel.formTitle} cats={cats} />,
            guards: [AuthGuard],
            path: "",
        };
    }

    private BuildObjectViewModelRoutes(viewModel: ObjectViewModel<any, any>, parentNode: PathTraceNode): Route
    {
        const schema = this.apiSchemaService.GetSchema(viewModel.schemaName) as OpenAPI.ObjectSchema;

        return {
            children: [
                ...viewModel.actions.map(action => this.BuildBoundActionRoute(action, viewModel.formTitle, parentNode.parent)),
                {
                    component: <ViewObjectComponent
                    actions={viewModel.actions}
                    baseRoute={parentNode.path}
                    heading={viewModel.formTitle}
                    requestObject={routeParams => viewModel.requestObject(RootInjector.Resolve(APIService), routeParams)}
                    schema={schema}
                    />,
                    path: ""
                }
            ],
            guards: [AuthGuard],
            path: ""
        };
    }

    private BuildUnboundResourceActionRoutes(displayName: string, viewModelSchemaName: string, action: UnboundResourceAction<any, any>, parentNode: PathTraceNode): Route
    {
        switch(action.type)
        {
            case "create":
                return {
                    component: <AddObjectComponent
                        createResource={(ids, data) => action.createResource(RootInjector.Resolve(APIService), ids, data)}
                        heading={displayName}
                        loadContext={(action.loadContext === undefined) ? undefined : (ids => action.loadContext!(RootInjector.Resolve(APIService), ids))}
                        postUpdateUrl={parentNode.path}
                        schema={this.apiSchemaService.GetSchema(action.schemaName ?? viewModelSchemaName) as OpenAPI.ObjectSchema}
                    />,
                    path: action.type,
                };
        }
    }

    private BuildRoutingViewModelRoutes(routing: RoutingViewModel, parentNode: PathTraceNode): Route
    {
        return {
            children: routing.entries.map(x => ({
                children: [this.BuildViewModelRoutes(x.viewModel, parentNode.CreateChild(x.key))],
                path: x.key
            })),
            path: "",
            guards: [AuthGuard],
        }
    }

    private BuildViewModelRoutes(viewModel: ViewModel, parentNode: PathTraceNode)
    {
        switch(viewModel.type)
        {
            case "collection":
                return this.BuildCollectionViewModelRoutes(viewModel, parentNode);
            case "component":
                return this.BuildComponentViewModelRoutes(viewModel);
            case "list":
                return this.BuildListViewModelRoutes(viewModel, parentNode);
            case "multiPage":
                return this.BuildMultiPageViewModelRoutes(viewModel, parentNode);
            case "object":
                return this.BuildObjectViewModelRoutes(viewModel, parentNode);
            case "routing":
                return this.BuildRoutingViewModelRoutes(viewModel, parentNode);
        }
    }

    private FindActions(viewModel: ViewModel)
    {
        switch(viewModel.type)
        {
            case "collection":
            case "list":
                return [];
            case "multiPage":
                return viewModel.actions;
            case "object":
                return viewModel.actions;
            case "component":
            case "routing":
                return [];
        }
    }
}