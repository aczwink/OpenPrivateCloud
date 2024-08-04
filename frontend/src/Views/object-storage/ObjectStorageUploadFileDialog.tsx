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
import { Component, DialogRef, FileSelect, FormField, Injectable, JSX_CreateElement, LineEdit } from "acfrontend";
import { APIService } from "../../Services/APIService";

@Injectable
export class ObjectStorageUploadFileDialog extends Component<{ file: File | null; resourceGroupName: string; resourceName: string; }>
{
    constructor(private dialogRef: DialogRef, private apiService: APIService)
    {
        super();

        this.fileId = "";
        this.file = null;
    }

    protected override Render(): RenderValue
    {
        return <fragment>
            <FormField title="Id">
                <LineEdit value={this.fileId} onChanged={this.OnIdChanged.bind(this)} />
            </FormField>
            <FormField title="File">
            {this.RenderFile()}
            </FormField>
        </fragment>;
    }

    //Private state
    private fileId: string;
    private file: File | null;

    //Private methods
    private RenderFile()
    {
        if(this.input.file === null)
            return <FileSelect onChanged={this.OnFileChanged.bind(this)} />;
        return this.input.file.name;
    }

    private Validate()
    {
        const idValid = (this.fileId.length > 0) && (this.fileId.trim().length === this.fileId.length);
        this.dialogRef.valid.Set(idValid && (this.file !== null));
    }

    //Event handlers
    private async OnAccept()
    {
        this.dialogRef.waiting.Set(true);
        await this.apiService.resourceProviders._any_.fileservices.objectstorage._any_.files._any_.put(this.input.resourceGroupName, this.input.resourceName, this.fileId, { file: this.file! })

        this.dialogRef.Close();
    }

    private OnFileChanged(newValue: File | null)
    {
        this.file = newValue;
        if((newValue !== null) && (this.fileId.trim().length === 0))
            this.fileId = newValue.name;
        this.Validate();
    }

    private OnIdChanged(newValue: string)
    {
        this.fileId = newValue;
        this.Validate();
    }

    override OnInitiated(): void
    {
        if(this.input.file !== null)
        {
            this.fileId = this.input.file.name;
            this.file = this.input.file;
        }
        this.Validate();
        this.dialogRef.onAccept.Subscribe(this.OnAccept.bind(this));
    }
}