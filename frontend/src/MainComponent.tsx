import { Anchor, Component, Injectable, JSX_CreateElement, Router } from "acfrontend";
import { RouterState, RouterStateNode } from "acfrontend/dist/Services/Router/RouterState";
import { Injector, Subscription } from "acts-util-core";
import { SideNavComponent } from "./UI/Components/SideNavComponent";

interface NavHistoryItem
{
    path: string;
    title: string;
}

@Injectable
export class MainComponent extends Component
{
    constructor(private router: Router, private injector: Injector)
    {
        super();

        this.navHistoryItems = [];
        this.component = null;
    }

    protected override Render(): RenderValue
    {
        return <fragment>
            <nav aria-label="breadcrumb">
                <ol className="breadcrumb">
                    {(this.navHistoryItems.length <= 1) ? null : this.navHistoryItems.map(this.RenderNavHistoryEntry.bind(this))}
                </ol>
            </nav>
            {this.component}
        </fragment>;
    }

    //Private state
    private navHistoryItems: NavHistoryItem[];
    private component: SingleRenderValue;
    private subscription?: Subscription;

    //Private methods
    private MergeNavHistoryItems(path: string, title: string)
    {
        const idx = this.navHistoryItems.findIndex(x => x.path === path);
        if(idx === -1)
        {
            this.navHistoryItems.push({
                path,
                title
            });
        }
        else
            this.navHistoryItems = this.navHistoryItems.slice(0, idx+1);
    }

    private RenderNavHistoryEntry(bc: NavHistoryItem, index: number)
    {
        if(index === (this.navHistoryItems.length - 1))
            return <li className="breadcrumb-item active">{bc.title}</li>

        return <li className="breadcrumb-item"><Anchor route={bc.path}>{bc.title}</Anchor></li>
    }

    //Event handlers
    override OnInitiated(): void
    {
        this.OnRouterStateChanged();
        this.subscription = this.router.state.Subscribe(this.OnRouterStateChanged.bind(this));
    }

    private OnRouterStateChanged()
    {
        const routerState = this.router.state.Get();

        let node: RouterStateNode | undefined = routerState.root;

        const components = [];
        let path = "";
        while(node)
        {
            if(node.route.path.length > 0)
                path += "/" + node.route.path;

            if(node.route.component)
            {
                const component = node.route.component;
                if(("type" in component) && (typeof component !== "string"))
                    components.push({
                        renderValue: component,
                        path,
                        node
                    });
                else
                {
                    const rv = {
                        type: component,
                        properties: null,
                        children: []
                    };
                    components.push({
                        renderValue: rv,
                        path,
                        node
                    });
                }
            }

            node = node.child;
        }

        const prev = components[components.length - 2];
        const current = components[components.length - 1];
        if(prev?.renderValue.type === SideNavComponent)
        {
            this.injector.RegisterInstance(RouterStateNode, current.node);
            this.MergeNavHistoryItems(RouterState.ReplaceRouteParams(prev.path, routerState.routeParams).join("/"), prev.renderValue.properties.formHeading(routerState.routeParams));
            this.component = components[components.length - 2].renderValue;
        }
        else
            this.component = components[components.length - 1].renderValue;

        if(!routerState.routeParams.OwnKeys().Any())
            this.navHistoryItems = [];
    }

    override OnUnmounted()
    {
        this.subscription?.Unsubscribe();
    }
}