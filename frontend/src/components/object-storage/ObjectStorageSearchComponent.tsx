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

import { Injectable, Component, JSX_CreateElement, FormField, AutoCompleteMultiSelectBox, LineEdit, RouterState, ProgressSpinner, Anchor, PopupManager, BootstrapIcon } from "acfrontend";
import { FileMetaDataOverviewDataDTO } from "../../../dist/api";
import { resourceProviders } from "openprivatecloud-common";
import { APIService } from "../../services/APIService";
import { APIResponseHandler } from "acfrontendex";
import { ObjectStorageThumbnailComponent } from "./ObjectStorageThumbnailComponent";
import { ObjectStorageUploadFileDialog } from "./ObjectStorageUploadFileDialog";

let dragCounter = 0;

@Injectable
export class ObjectStorageSearchComponent extends Component<{ resourceGroupName: string; resourceName: string; }>
{
    constructor(private apiService: APIService, private routerState: RouterState, private popupManager: PopupManager, private apiResponseHandler: APIResponseHandler)
    {
        super();

        this.name = "";
        this.mediaType = "";
        this.tags = [];
        this.result = [];
    }

    protected override Render(): RenderValue
    {
        return <div ondragenter={this.OnDragEnter.bind(this)} ondragleave={this.OnDragLeave.bind(this)} ondragover={this.OnDragOver.bind(this)} ondrop={this.OnDrop.bind(this)} style="min-height: 80vh">
            {this.RenderSearchForm()}
            {this.RenderResultList()}
            <button type="button" className="btn btn-primary" onclick={this.OnAddFile.bind(this, null)}><BootstrapIcon>plus</BootstrapIcon></button>
        </div>;
    }

    //Private state
    private name: string;
    private mediaType: string;
    private tags: string[];
    private result: FileMetaDataOverviewDataDTO[] | null;

    //Private methods
    private RenderSearchForm()
    {
        const mapped = this.tags.map(x => ({ key: x, displayValue: x }));

        return <form onsubmit={this.OnSearch.bind(this)}>
            <div className="row">
                <div className="col">
                    <FormField title="Name">
                        <LineEdit value={this.name} onChanged={newValue => this.name = newValue} />
                    </FormField>
                </div>
                <div className="col">
                    <FormField title="Media type">
                        <LineEdit value={this.mediaType} onChanged={newValue => this.mediaType = newValue} />
                    </FormField>
                </div>
                <div className="col">
                    <FormField title="Tags">
                        <AutoCompleteMultiSelectBox selection={mapped} onChanged={kvs => this.tags = kvs.map(x => x.key)} onLoadSuggestions={this.OnLoadTags.bind(this)} />
                    </FormField>
                </div>
                <div className="col-auto">
                    <button className="btn btn-primary" type="submit">Search</button>
                </div>
            </div>
        </form>;
    }

    private RenderResultList()
    {
        const resourceGroupName = this.routerState.routeParams.resourceGroupName!;
        const resourceName = this.routerState.routeParams.resourceName!;

        if(this.result === null)
            return <ProgressSpinner />;

        const fileUrlPrefix = "/resourcegroups/" + resourceGroupName + "/resources/" + resourceProviders.fileServices.name + "/" + resourceProviders.fileServices.objectStorageResourceType.name + "/" + resourceName + "/file-explorer/files/";
        return <table className="table table-striped table-sm">
            <thead>
                <tr>
                    <th> </th>
                    <th>Id</th>
                    <th>Last access time</th>
                    <th>Size</th>
                    <th>Tags</th>
                </tr>
            </thead>
            <tbody>
                {this.result.map(obj => <tr>
                    <td><ObjectStorageThumbnailComponent fileMetadata={obj} resourceGroupName={resourceGroupName} resourceName={resourceName} /></td>
                    <td><Anchor route={fileUrlPrefix + encodeURIComponent(obj.id)}>{obj.id}</Anchor></td>
                    <td>{obj.lastAccessTime.toLocaleString()}</td>
                    <td>{obj.size.FormatBinaryPrefixed()}</td>
                    <td>{obj.tags.join(", ")}</td>
                </tr>)}
            </tbody>
        </table>;
    }

    //Event handlers
    private OnAddFile(file: File | null)
    {
        const resourceGroupName = this.routerState.routeParams.resourceGroupName!;
        const resourceName = this.routerState.routeParams.resourceName!;

        const ref = this.popupManager.OpenDialog(<ObjectStorageUploadFileDialog file={file} resourceGroupName={resourceGroupName} resourceName={resourceName} />, {
            title: "Upload file"
        });

        return new Promise(resolve => {
            ref.onClose.Subscribe(resolve);
        });
    }

    private OnDragEnter(event: DragEvent)
    {
        dragCounter++;
        const elem = (this.vNode?.domNode as HTMLElement);
        elem.className = "border border-2 border-primary rounded shadow";
    }

    private OnDragLeave(event: DragEvent)
    {
        dragCounter--;
        if(dragCounter === 0)
        {
            const elem = (this.vNode?.domNode as HTMLElement);
            elem.className = "";
        }
    }

    private OnDragOver(event: DragEvent)
    {
        event.preventDefault();
        if(event.dataTransfer)
            event.dataTransfer.dropEffect = "copy";
    }

    private async OnDrop(event: DragEvent)
    {
        event.preventDefault();

        this.OnDragLeave(event); //remove style

        if(event.dataTransfer === null)
            return;

        const files: File[] = [];
        if (event.dataTransfer.items)
        {
            [...event.dataTransfer.items].forEach((item, i) =>
            {
                if (item.kind === "file")
                {
                    const file = item.getAsFile();
                    if(file === null)
                        return;
                    files.push(file);
                }
            });
        }
        else
        {
            [...event.dataTransfer.files].forEach((file, i) => {
                files.push(file);
            });
        }

        for (const file of files)
        {
            await this.OnAddFile(file);    
        }
    }

    private async OnLoadTags(searchText: string)
    {
        const resourceGroupName = this.routerState.routeParams.resourceGroupName!;
        const resourceName = this.routerState.routeParams.resourceName!;
        const response = await this.apiService.resourceProviders._any_.fileservices.objectstorage._any_.tags.get(resourceGroupName, resourceName);
        const result = await this.apiResponseHandler.ExtractDataFromResponseOrShowErrorMessageOnError(response);
        if(result.ok)
        {
            searchText = searchText.toLowerCase()
            return result.value.filter(x => x.toLowerCase().includes(searchText)).map(x => ({
                key: x,
                displayValue: x
            }));
        }
        return [];
    }

    private async OnSearch(event: Event)
    {
        event.preventDefault();

        this.result = null;

        const resourceGroupName = this.routerState.routeParams.resourceGroupName!;
        const resourceName = this.routerState.routeParams.resourceName!;
        const response = await this.apiService.resourceProviders._any_.fileservices.objectstorage._any_.files.get(resourceGroupName, resourceName, {
            mediaType: this.mediaType,
            name: this.name,
            tags: this.tags.join(",")
        });
        const result = await this.apiResponseHandler.ExtractDataFromResponseOrShowErrorMessageOnError(response);
        if(result.ok)
            this.result = result.value;
        else
            this.result = [];
    }
}