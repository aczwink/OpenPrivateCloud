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

import { BootstrapIcon, Component, Injectable, JSX_CreateElement, PopupManager } from "acfrontend";
import { APIService } from "../../Services/APIService";
import { FileMetaDataOverviewDataDTO } from "../../../dist/api";

@Injectable
export class ObjectStorageThumbnailComponent extends Component<{ resourceGroupName: string; resourceName: string; fileMetadata: FileMetaDataOverviewDataDTO }>
{
    constructor(private apiService: APIService, private popupManager: PopupManager)
    {
        super();

        this.thumb = null;
        this.tile = null;
        this.preview = null;
        this.showPreview = false;
    }

    protected Render(): RenderValue
    {
        function OnPlay(event: Event)
        {
            const elem = event.target as HTMLVideoElement;
            elem.defaultPlaybackRate = 1.25;
            elem.playbackRate = 1.25;
        }

        const sizeStyle = "max-width: 256px; max-height: 128px;";
        const style = sizeStyle + " cursor: zoom-in;";
        if(this.showPreview)
        {
            return <div onmouseleave={() => this.showPreview = false} onclick={this.ShowTile.bind(this)}>
                <video autoplay={true} loop={true} controls={false} muted={true} onplay={OnPlay} style={style}>
                    <source src={this.preview!} type="video/mp4" />
                </video>
            </div>;
        }

        if(this.thumb !== null)
        {
            if(this.tile !== null)
            {
                if(this.preview !== null)
                {
                    return <img src={this.thumb} style={style} onclick={this.ShowTile.bind(this)} onmouseenter={() => this.showPreview = true} />
                }
                return <img src={this.thumb} style={style} onclick={this.ShowTile.bind(this)} />
            }
            return <img src={this.thumb} style={sizeStyle} />
        }

        switch(this.input.fileMetadata.mediaType)
        {
            case "application/json":
                return <BootstrapIcon>filetype-json</BootstrapIcon>;
            case "application/octet-stream":
                return <BootstrapIcon>file-binary</BootstrapIcon>;
        }

        if(this.input.fileMetadata.mediaType.startsWith("image/"))
            return <BootstrapIcon>file-image</BootstrapIcon>;
        if(this.input.fileMetadata.mediaType.startsWith("video/"))
            return <BootstrapIcon>film</BootstrapIcon>;

        return this.input.fileMetadata.mediaType;
    }

    //Private state
    private thumb: string | null;
    private tile: string | null;
    private preview: string | null;
    private showPreview: boolean;

    //Private methods
    private GetDataAs(base64: string | ArrayBuffer | null, mime: string)
    {
        const data = base64 as string;
        const prefix = "data:text/xml";

        return "data:" + mime + data.substring(prefix.length);
    }

    private async LoadData()
    {
        if(this.input.fileMetadata.mediaType.startsWith("image/") || this.input.fileMetadata.mediaType.startsWith("video/"))
        {
            const response = await this.apiService.resourceProviders._any_.fileservices.objectstorage._any_.files._any_.thumb.get(this.input.resourceGroupName, this.input.resourceName, this.input.fileMetadata.id, { thumbType: "" });
            if(response.statusCode === 200)
            {
                const reader = new FileReader();
                reader.readAsDataURL(response.data);
                reader.onloadend = () => this.thumb = this.GetDataAs(reader.result, "image/jpg");
            }
        }

        if(this.input.fileMetadata.mediaType.startsWith("video/"))
        {
            const response = await this.apiService.resourceProviders._any_.fileservices.objectstorage._any_.files._any_.thumb.get(this.input.resourceGroupName, this.input.resourceName, this.input.fileMetadata.id, { thumbType: "t" });
            if(response.statusCode === 200)
            {
                const reader = new FileReader();
                reader.readAsDataURL(response.data);
                reader.onloadend = () => this.tile = this.GetDataAs(reader.result, "image/jpg");
            }

            const response2 = await this.apiService.resourceProviders._any_.fileservices.objectstorage._any_.files._any_.thumb.get(this.input.resourceGroupName, this.input.resourceName, this.input.fileMetadata.id, { thumbType: "p" });
            if(response2.statusCode === 200)
            {
                const reader = new FileReader();
                reader.readAsDataURL(response2.data);
                reader.onloadend = () => this.preview = this.GetDataAs(reader.result, "video/mp4");
            }
        }
    }

    private ShowTile(event: Event)
    {
        event.preventDefault();
        event.stopPropagation();
        this.popupManager.OpenModal(<img src={this.tile!} />, { className: "fade show d-block text-center" });
    }

    //Event handlers
    override OnInitiated(): void
    {
        this.LoadData();
    }

    override OnInputChanged(): void
    {
        this.thumb = null;
        this.tile = null;
        this.showPreview = false;
        this.preview = null;
        this.LoadData();
    }
}