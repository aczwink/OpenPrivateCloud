/**
 * OpenPrivateCloud
 * Copyright (C) 2019-2025 Amir Czwink (amir130@hotmail.de)
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

import { Anchor, BootstrapIcon, Component, Injectable, JSX_CreateElement, ProgressSpinner, SelectableTable } from "acfrontend";
import { FileEntry } from "../../../dist/api";
import { APIService } from "../../services/APIService";
import { APIResponseHandler } from "acfrontendex";

@Injectable
export class DirectoryViewComponent extends Component<{ resourceGroupName: string; resourceName: string }>
{
    constructor(private apiService: APIService, private apiResponseHandler: APIResponseHandler)
    {
        super();

        this.dirPath = "/";
        this.entries = null;
        this.selectedEntryNames = [];
    }
    
    protected Render(): RenderValue
    {
        if( (this.entries === null) )
            return <ProgressSpinner />;

        const columns = ["", "Name", "Size", "Owner"];

        return <fragment>
            <h2>{this.dirPath}</h2>{this.RenderUpwardsButton()}
            <SelectableTable columns={columns} multiSelections={true} rowKeys={this.entries.map( x => x.fileName )} selectedRowKeys={this.selectedEntryNames} selectionChanged={newValue => this.selectedEntryNames = newValue}>
                {this.entries.map(this.RenderEntry.bind(this))}
            </SelectableTable>
        </fragment>;
    }

    //Private variables
    private dirPath: string;
    private entries: FileEntry[] | null;
    private selectedEntryNames: string[];

    //Private methods
    private JoinPaths(dirPath: string, childName: string)
    {
        if(dirPath.endsWith("/"))
            return dirPath + childName;
        return dirPath + "/" + childName;
    }

    private async QueryEntries(path: string)
    {
        const response = await this.apiService.resourceProviders._any_.fileservices.filestorage._any_.contents.get(this.input.resourceGroupName, this.input.resourceName, { dirPath: path });
        const result = await this.apiResponseHandler.ExtractDataFromResponseOrShowErrorMessageOnError(response);
        if(result.ok)
        {
            this.dirPath = path;
            this.entries = result.value;
        }
    }

    private RenderEntry(entry: FileEntry)
    {
        return <tr>
            <td><BootstrapIcon>{entry.type === "directory" ? "folder" : "file"}</BootstrapIcon></td>
            <td>{this.RenderTitle(entry)}</td>
            <td>{entry.size.FormatBinaryPrefixed("B")}</td>
            <td>{entry.opcUserId}</td>
        </tr>;
    }

    private RenderTitle(entry: FileEntry)
    {
        switch(entry.type)
        {
            case "directory":
                return <a className="" role="button" onclick={ this.OnDirChanged.bind(this, this.JoinPaths(this.dirPath, entry.fileName)) }>{entry.fileName}</a>;
            case "file":
                return <Anchor route={"/filemanager/editfile?filePath=" + this.dirPath + "/" + entry.fileName}>{entry.fileName}</Anchor>;
        }
    }

    private RenderUpwardsButton()
    {
        return <button className="btn btn-secondary" type="button" onclick={this.OnMoveUpwards.bind(this)} disabled={this.dirPath === "/"}><BootstrapIcon>arrow-up-square-fill</BootstrapIcon></button>
    }

    //Event handlers
    private OnDirChanged(path: string)
    {
        this.entries = null;
        this.QueryEntries(path);
    }

    public override OnInitiated()
    {
        this.QueryEntries(this.dirPath);
    }

    private OnMoveUpwards()
    {
        const pos = this.dirPath.lastIndexOf("/");
        const parent = this.dirPath.substring(0, pos);
        const realParent = parent.length === 0 ? "/" : parent;
        this.QueryEntries(realParent);
    }
}