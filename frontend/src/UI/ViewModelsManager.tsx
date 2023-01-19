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
        return this.viewModelsRoots.map(x => this.BuildRoutingViewModelRoutes(x, "/", "/"));
    }

    public Register(viewModelRoot: RoutingViewModel)
    {
        this.viewModelsRoots.push(viewModelRoot);
    }

    //Private variables
    private viewModelsRoots: RoutingViewModel[];

    //Private methods
    private BuildBoundActionComponent(action: IdBoundResourceAction<any, any, any>, formTitle: (ids: any) => string, parentRoute: string)
    {
        switch(action.type)
        {
            case "delete":
                return <DeleteObjectComponent
                    deleteResource={ids => action.deleteResource(RootInjector.Resolve(APIService), ids)}
                    postDeleteUrl={parentRoute}
                    />;
            case "edit":
                return <EditObjectComponent
                    formTitle={formTitle}
                    postUpdateUrl={parentRoute}
                    requestObject={async ids => (await action.requestObject(RootInjector.Resolve(APIService), ids))}
                    updateResource={(ids, obj) => action.updateResource(RootInjector.Resolve(APIService), ids, obj)}
                    schema={this.apiSchemaService.GetSchema(action.propertiesSchemaName) as OpenAPI.ObjectSchema}
                    loadContext={(action.loadContext === undefined) ? undefined : (ids => action.loadContext!(RootInjector.Resolve(APIService), ids))}
                    />;
        }
    }

    private BuildBoundActionRoute(action: IdBoundResourceAction<any, any, any>, formTitle: (ids: any) => string, parentRoute: string): Route
    {
        return {
            component: this.BuildBoundActionComponent(action, formTitle, parentRoute),
            path: action.type
        };
    }

    private BuildCollectionViewModelRoutes(viewModel: CollectionViewModel<any, any, any>, baseRoute: string): Route
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
                children: [this.BuildViewModelRoutes(x.viewModel, baseRoute + "/" + x.key, baseRoute)],
                path: x.key
            })))
            : ([{
                children: [this.BuildViewModelRoutes(viewModel.child, baseRoute + "/:" + viewModel.idKey, baseRoute)],
                path: ":" + viewModel.idKey,
            }]);

        return {
            children: [
                ...viewModel.actions.map(action => this.BuildUnboundResourceActionRoutes(viewModel.displayName, viewModel.schemaName, action, baseRoute)),
                ...children,
                {
                    component: <ObjectListComponent
                        idBoundActions={this.FindActions(viewModel.child)}
                        baseUrl={baseRoute}
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

    private BuildListViewModelRoutes(viewModel: ListViewModel<any, any>, baseRoute: string): Route
    {
        const schema = this.apiSchemaService.GetSchema(viewModel.schemaName) as OpenAPI.ObjectSchema;

        return {
            children: [
                ...viewModel.actions.map(action => this.BuildUnboundResourceActionRoutes(viewModel.displayName, viewModel.schemaName, action, baseRoute)),
                {
                    component: <ObjectListComponent
                        idBoundActions={[]}
                        baseUrl={baseRoute}
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

    private BuildMultiPageViewModelRoutes(viewModel: MultiPageViewModel<any>, baseRoute: string): Route
    {
        if(viewModel.entries.length === 0)
        {
            return {
                path: "",
            };
        }

        const objectTypes = viewModel.entries.map(x => ({ key: x.key, displayName: x.displayName, icon: x.icon }));

        return {
            children: [
                ...viewModel.actions.map(action => this.BuildBoundActionRoute(action, viewModel.formTitle, baseRoute)),
                ...viewModel.entries.map(x => {
                    const childRoute = this.BuildViewModelRoutes(x.child, baseRoute + "/" + x.key, baseRoute);
                
                    return {
                        path: (childRoute.path === "" ? x.key : (x.key + "/" + childRoute.path)),
                        children: childRoute.children,
                        component: childRoute.component,
                    };
                }),
                {
                    path: "",
                    redirect: viewModel.entries[0].key
                }
            ],
            component: <SideNavComponent actions={viewModel.actions} baseRoute={baseRoute} formHeading={viewModel.formTitle} objectTypes={objectTypes} />,
            guards: [AuthGuard],
            path: "",
        };
    }

    private BuildObjectViewModelRoutes(viewModel: ObjectViewModel<any, any>, baseRoute: string, parentRoute: string): Route
    {
        const schema = this.apiSchemaService.GetSchema(viewModel.schemaName) as OpenAPI.ObjectSchema;

        return {
            children: [
                ...viewModel.actions.map(action => this.BuildBoundActionRoute(action, viewModel.formTitle, parentRoute)),
                {
                    component: <ViewObjectComponent
                    actions={viewModel.actions}
                    baseRoute={baseRoute}
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

    private BuildUnboundResourceActionRoutes(displayName: string, viewModelSchemaName: string, action: UnboundResourceAction<any, any>, parentPath: string): Route
    {
        switch(action.type)
        {
            case "create":
                return {
                    component: <AddObjectComponent
                        createResource={(ids, data) => action.createResource(RootInjector.Resolve(APIService), ids, data)}
                        heading={displayName}
                        loadContext={(action.loadContext === undefined) ? undefined : (ids => action.loadContext!(RootInjector.Resolve(APIService), ids))}
                        postUpdateUrl={parentPath}
                        schema={this.apiSchemaService.GetSchema(action.schemaName ?? viewModelSchemaName) as OpenAPI.ObjectSchema}
                    />,
                    path: action.type,
                };
        }
    }

    private BuildRoutingViewModelRoutes(routing: RoutingViewModel, baseRoute: string, parentRoute: string): Route
    {
        return {
            children: routing.entries.map(x => ({
                children: [this.BuildViewModelRoutes(x.viewModel, baseRoute + x.key, parentRoute)],
                path: x.key
            })),
            path: "",
            guards: [AuthGuard],
        }
    }

    private BuildViewModelRoutes(viewModel: ViewModel, baseRoute: string, parentRoute: string)
    {
        switch(viewModel.type)
        {
            case "collection":
                return this.BuildCollectionViewModelRoutes(viewModel, baseRoute);
            case "component":
                return this.BuildComponentViewModelRoutes(viewModel);
            case "list":
                return this.BuildListViewModelRoutes(viewModel, baseRoute);
            case "multiPage":
                return this.BuildMultiPageViewModelRoutes(viewModel, baseRoute);
            case "object":
                return this.BuildObjectViewModelRoutes(viewModel, baseRoute, parentRoute);
            case "routing":
                return this.BuildRoutingViewModelRoutes(viewModel, baseRoute, parentRoute);
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