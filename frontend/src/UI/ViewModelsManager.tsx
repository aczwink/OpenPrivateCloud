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

import { Injectable, JSX_CreateElement, RootInjector, Route } from "acfrontend";
import { OpenAPI } from "acts-util-core";
import { AuthGuard } from "../AuthGuard";
import { APISchemaService } from "../Services/APISchemaService";
import { AddObjectComponent } from "./AddObjectComponent";
import { BoundResourceAction } from "./BoundActions";
import { DeleteObjectComponent } from "./DeleteObjectComponent";
import { ObjectListComponent } from "./ObjectListComponent";
import { SideNavComponent } from "./SideNavComponent";
import { UnboundResourceAction } from "./UnboundActions";
import { CollectionViewModel, MultiPageViewModel, ObjectViewModel, ViewModel, RoutingViewModel, ComponentViewModel } from "./ViewModel";
import { ViewObjectComponent } from "./ViewObjectComponent";

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
    private BuildBoundActionComponent(action: BoundResourceAction<any, any>, serviceType: Instantiatable<any>, parentRoute: string)
    {
        switch(action.type)
        {
            case "delete":
                return <DeleteObjectComponent
                    deleteResource={ids => action.deleteResource(RootInjector.Resolve(serviceType), ids)}
                    postDeleteUrl={parentRoute}
                    />;
        }
    }

    private BuildBoundActionRoute(action: BoundResourceAction<any, any>, serviceType: Instantiatable<any>, parentRoute: string): Route
    {
        return {
            component: this.BuildBoundActionComponent(action, serviceType, parentRoute),
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
                ...viewModel.actions.map(action => this.BuildUnboundResourceActionRoutes(viewModel, action, baseRoute)),
                ...children,
                {
                    component: <ObjectListComponent
                        actions={this.FindActions(viewModel.child)}
                        baseUrl={baseRoute}
                        customRouting={viewModel.customRouting}
                        elementSchema={mappedSchema}
                        extractId={viewModel.extractId}
                        heading={viewModel.displayName}
                        requestObjects={ids => viewModel.requestObjects(RootInjector.Resolve(viewModel.service), ids)}
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

    private BuildMultiPageViewModelRoutes(viewModel: MultiPageViewModel<any, any>, baseRoute: string, parentRoute: string): Route
    {
        if(viewModel.entries.length === 0)
        {
            return {
                path: "",
            };
        }

        const objectTypes = viewModel.entries.map(x => ({ key: x.key, displayName: x.displayName }));

        return {
            children: [
                ...viewModel.actions.map(action => this.BuildBoundActionRoute(action, viewModel.service, parentRoute)),
                ...viewModel.entries.map(x => {
                    const childRoute = this.BuildViewModelRoutes(x.child, baseRoute + "/" + x.key, parentRoute);
                
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

    private BuildObjectViewModelRoutes(viewModel: ObjectViewModel<any, any, any>, baseRoute: string, parentRoute: string): Route
    {
        const schema = this.apiSchemaService.GetSchema(viewModel.schemaName) as OpenAPI.ObjectSchema;

        return {
            children: [
                ...viewModel.actions.map(action => this.BuildBoundActionRoute(action, viewModel.service, parentRoute)),
                {
                    component: <ViewObjectComponent
                    heading={viewModel.formTitle}
                    requestObject={routeParams => viewModel.requestObject(RootInjector.Resolve(viewModel.service), routeParams)}
                    schema={schema}
                    />,
                    path: ""
                }
            ],
            guards: [AuthGuard],
            path: ""
        };
    }

    private BuildUnboundResourceActionRoutes(viewModel: CollectionViewModel<any, any, any>, action: UnboundResourceAction<any, any, any, any>, parentPath: string): Route
    {
        switch(action.type)
        {
            case "create":
                return {
                    component: <AddObjectComponent
                        createResource={(ids, data) => action.createResource(RootInjector.Resolve(viewModel.service), ids, data)}
                        heading={viewModel.displayName}
                        postUpdateUrl={parentPath}
                        schema={this.apiSchemaService.GetSchema(action.schemaName ?? viewModel.schemaName) as OpenAPI.ObjectSchema}
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
            case "multiPage":
                return this.BuildMultiPageViewModelRoutes(viewModel, baseRoute, parentRoute);
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
            case "component":
                throw new Error("Not implemented");
            case "multiPage":
                return viewModel.actions;
            case "object":
                return viewModel.actions;
            case "routing":
                return [];
        }
    }
}