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
import { FFProbe_VideoStreamInfo, FileMetaDataOverviewDataDTO, ObjectStorageBlobIndex } from "../../../dist/api";
import { APIService } from "../../services/APIService";

@Injectable
export class ObjectStorageThumbnailComponent extends Component<{ resourceGroupName: string; resourceName: string; fileMetadata: FileMetaDataOverviewDataDTO }>
{
    constructor(private apiService: APIService, private popupManager: PopupManager)
    {
        super();

        this.extraMetadata = null;
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
        
        return <div className="position-relative d-inline-block">
            {this.RenderThumb(style, sizeStyle)}
            {this.RenderBadge()}
        </div>;
    }

    //Private state
    private extraMetadata: ObjectStorageBlobIndex | null;
    private thumb: string | null;
    private tile: string | null;
    private preview: string | null;
    private showPreview: boolean;

    //Private methods
    private ComputeBestResolution(stream: FFProbe_VideoStreamInfo)
    {
        if(this.input.fileMetadata.mediaType.startsWith("image/"))
        {
            const mp = stream.width * stream.height / 1024 / 1024;

            const resolutions = [
                { megapixel: 1, color: "danger" },
                { megapixel: 2, color: "warning" },
                { megapixel: 3, color: "info" },
                { megapixel: 12, color: "success" },
            ];
            let best = resolutions[0];
            let bestD = Number.MAX_SAFE_INTEGER;
            for (const resolution of resolutions)
            {
                const d = Math.abs(mp - resolution.megapixel);
                if(d < bestD)
                {
                    best = resolution;
                    bestD = d;
                }
            }

            return {
                content: best.megapixel + "MP",
                color: best.color
            };
        }

        const resolutions = [
            { height: 144, color: "danger", content: "144p"  },
            { height: 240, color: "danger", content: "240p"  },
            { height: 360, color: "danger", content: "360p"  },
            { height: 480, color: "warning", content: <BootstrapIcon>badge-sd-fill</BootstrapIcon>  },
            { height: 720, color: "info", content: <BootstrapIcon>badge-hd-fill</BootstrapIcon> },
            { height: 1080, color: "success", content: <BootstrapIcon>badge-hd-fill</BootstrapIcon> },
            { height: 2160, color: "primary", content: <BootstrapIcon>badge-4k-fill</BootstrapIcon> },
        ];
        let best = resolutions[0];
        let bestD = Number.MAX_SAFE_INTEGER;
        for (const resolution of resolutions)
        {
            const streamSize = Math.min(stream.width, stream.height);
            const d = Math.abs(streamSize - resolution.height);
            if(d < bestD)
            {
                best = resolution;
                bestD = d;
            }
        }

        return {
            content: best.content,
            color: best.color
        };
    }

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

            const response2 = await this.apiService.resourceProviders._any_.fileservices.objectstorage._any_.files._any_.extrameta.get(this.input.resourceGroupName, this.input.resourceName, this.input.fileMetadata.id);
            if(response2.statusCode === 200)
                this.extraMetadata = response2.data;
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

    private RenderBadge()
    {
        if((this.extraMetadata === null) || (this.extraMetadata.meta.av === undefined))
            return null;

        const videoStream = this.extraMetadata.meta.av.streams.find(x => x.codec_type === "video") as FFProbe_VideoStreamInfo;
        const content = this.ComputeBestResolution(videoStream);
        return <span className={"position-absolute top-0 start-100 translate-middle badge rounded-pill text-bg-" + content.color}>
            {content.content}
        </span>;
    }

    private RenderThumb(style: string, sizeStyle: string)
    {
        if(this.thumb !== null)
        {
            if(this.tile !== null)
            {
                if(this.preview !== null)
                {
                    return <img src={this.thumb} style={style} onclick={this.ShowTile.bind(this)} onmouseenter={() => this.showPreview = true} />;
                }
                return <img src={this.thumb} style={style} onclick={this.ShowTile.bind(this)} />
            }
            return <img src={this.thumb} style={sizeStyle} />;
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