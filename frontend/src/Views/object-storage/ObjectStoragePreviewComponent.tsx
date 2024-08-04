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

import { Injectable, Component, RouterState, JSX_CreateElement, ProgressSpinner } from "acfrontend";
import { APIService, BACKEND_HOST } from "../../Services/APIService";
import { ExtractDataFromResponseOrShowErrorMessageOnError } from "../../UI/ResponseHandler";

@Injectable
export class ObjectStoragePreviewComponent extends Component
{
    constructor(private apiService: APIService, private routerState: RouterState)
    {
        super();

        this.tile = null;
        this.fullImage = null;
        this.loading = true;
        this.mediaType = "";
        this.videoStreamId = null;
        this.textData = null;
    }

    protected override Render(): RenderValue
    {
        if(this.loading)
            return <ProgressSpinner />;

        if(this.videoStreamId !== null)
        {            
            const src = `https://${BACKEND_HOST}/public/largeFile/${this.videoStreamId}`;
            return <video controls poster={this.tile!}>
                <source src={src} type={this.mediaType} />
            </video>;
        }
        if(this.fullImage !== null)
        {
            return <div className="row">
                <div className="col d-flex justify-content-center flex-grow-1"><img src={this.fullImage} /></div>
            </div>;
        }
        if(this.textData !== null)
        {
            return <textarea className="form-control" cols="80" rows="12" readOnly>{this.textData}</textarea>
        }
        return "No preview available";
    }

    //Private state
    private tile: string | null;
    private fullImage: string | null;
    private loading: boolean;
    private mediaType: string;
    private videoStreamId: string | null;
    private textData: string | null;

    //Private methods
    private GetDataAs(base64: string | ArrayBuffer | null, mime: string)
    {
        const data = base64 as string;
        const prefix = "data:text/xml";

        return "data:" + mime + data.substring(prefix.length);
    }

    private async LoadData()
    {
        const resourceGroupName = this.routerState.routeParams.resourceGroupName!;
        const resourceName = this.routerState.routeParams.resourceName!;
        const fileId = this.routerState.routeParams.fileId!;

        const response = await this.apiService.resourceProviders._any_.fileservices.objectstorage._any_.files._any_.get(resourceGroupName, resourceName, fileId);
        const result = await ExtractDataFromResponseOrShowErrorMessageOnError(response);
        if(!result.ok)
            return;
        const fileMetadata = result.value;
        this.mediaType = fileMetadata.mediaType;

        if(fileMetadata.mediaType.startsWith("image/"))
        {
            const response = await this.apiService.resourceProviders._any_.fileservices.objectstorage._any_.files._any_.blob.get(resourceGroupName, resourceName, fileId);
            if(response.statusCode === 200)
            {
                const reader = new FileReader();
                reader.readAsDataURL(response.data);
                reader.onloadend = () => this.fullImage = this.GetDataAs(reader.result, "image/jpg");
            }
        }
        else if(fileMetadata.mediaType.startsWith("video/"))
        {
            const response = await this.apiService.resourceProviders._any_.fileservices.objectstorage._any_.files._any_.thumb.get(resourceGroupName, resourceName, fileId, { thumbType: "t" });
            if(response.statusCode === 200)
            {
                const reader = new FileReader();
                reader.readAsDataURL(response.data);
                reader.onloadend = () => this.tile = this.GetDataAs(reader.result, "image/jpg");
            }

            if(this.SupportsStreaming(fileMetadata.mediaType))
            {    
                const response3 = await this.apiService.resourceProviders._any_.fileservices.objectstorage._any_.files._any_.createBlobStream.get(resourceGroupName, resourceName, fileId);
                if(response3.statusCode === 200)
                {
                    this.videoStreamId = response3.data;
                }
            }
        }
        else if(fileMetadata.mediaType === "text/plain")
        {
            const response = await this.apiService.resourceProviders._any_.fileservices.objectstorage._any_.files._any_.blob.get(resourceGroupName, resourceName, fileId);
            if(response.statusCode === 200)
            {
                this.textData = await response.data.text();
            }
        }
    }

    private SupportsStreaming(mediaType: string)
    {
        switch(mediaType)
        {
            case "video/mp4":
                return true;
        }
        return false;
    }

    //Event handlers
    override async OnInitiated(): Promise<void>
    {
        await this.LoadData();
        this.loading = false;
    }
}