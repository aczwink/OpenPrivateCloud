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
import { RootInjector, FileDownloadService, PopupManager, ProgressSpinner, JSX_CreateElement, Component } from "acfrontend";
import { ResponseData } from "../../dist/api";
import { ExtractDataFromResponseOrShowErrorMessageOnError } from "../UI/ResponseHandler";
import { Property } from "acts-util-core";

class DownloadModalPopup extends Component<{ progress: Property<ProgressEvent | null>; startTime: number; }>
{
    protected override Render(): RenderValue
    {
        return <div className="modal-dialog">
            <div className="modal-content">
                <div className="modal-body">
                    <p>Downloading file. Standby...</p>
                    {this.RenderStatus()}
                </div>
            </div>
        </div>;
    }

    //Private methods
    private RenderStatus()
    {
        const v = this.input.progress.Get();
        if(v === null)
            return <ProgressSpinner />;

        const dt = (Date.now() - this.input.startTime) / 1000;
        const speed = v.loaded / dt;
        if(v.lengthComputable)
        {
            const percent = Math.round(v.loaded / v.total * 100);
            return <fragment>
                <div className="progress">
                    <div className="progress-bar" style={"width: " + percent + "%"}>{percent}%</div>
                </div>
                <br />
                Downloaded: {v.loaded.FormatBinaryPrefixed("B")} of {v.total.FormatBinaryPrefixed("B")} ({speed.FormatBinaryPrefixed("B")}/s)
            </fragment>;
        }
        return "Downloaded: " + v.loaded.FormatBinaryPrefixed("B") + " (" + speed.FormatBinaryPrefixed("B") + "/s)";
    }

    //Event handlers
    override OnInitiated(): void
    {
        this.input.progress.Subscribe(this.Update.bind(this));
    }
}

export async function DownloadFileUsingProgressPopup(fileName: string, initRequest: (progressTracker: (event: ProgressEvent) => void) => Promise<ResponseData<number, number, Blob>>)
{
    const prop = new Property<ProgressEvent | null>(null);
    const ref = RootInjector.Resolve(PopupManager).OpenModal(<DownloadModalPopup progress={prop} startTime={Date.now()} />, { className: "fade show d-block" });

    const response = await initRequest(event => prop.Set(event));

    ref.Close();
    const result = await ExtractDataFromResponseOrShowErrorMessageOnError(response);
    if(result.ok)
        RootInjector.Resolve(FileDownloadService).DownloadBlobAsFile(result.value, fileName);
    return response;
}