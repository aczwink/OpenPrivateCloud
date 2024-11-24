/**
 * OpenPrivateCloud
 * Copyright (C) 2023-2024 Amir Czwink (amir130@hotmail.de)
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

import { Injectable, Component, JSX_CreateElement, Select, FormField } from "acfrontend";
import { resourceProviders } from "openprivatecloud-common";
import { APIService } from "../../services/APIService";
import { ResourceSelectionComponent } from "./ResourceSelectionComponent";
import { APIResponseHandler } from "acfrontendex";

@Injectable
export class KeyVaultObjectReferenceSelectionComponent extends Component<{ objectType: "certificate" | "key" | "secret"; value: string | null; onChanged: (newValue: string | null) => void; }>
{
    constructor(private apiService: APIService, private apiResponseHandler: APIResponseHandler)
    {
        super();

        this.kvExternalId = null;
        this.objectName = null;
        this.possibleObjectNames = null;
    }
    
    protected override Render(): RenderValue
    {
        return <div className="row">
            <div className="col">
                <FormField title="Key Vault Resource">
                    <ResourceSelectionComponent resourceProviderName={resourceProviders.securityServices.name} resourceTypeName={resourceProviders.securityServices.keyVaultResourceTypeName.name} value={this.kvExternalId} valueChanged={this.OnKeyVaultReferenceChanged.bind(this)} />
                </FormField>
            </div>
            <div className="col">
                <FormField title="Object">
                    <Select onChanged={this.OnSecretSelectionChanged.bind(this)}>{this.RenderObjectOptions()}</Select>
                </FormField>
            </div>
        </div>;
    }

    //Private state
    private kvExternalId: string | null;
    private objectName: string | null;
    private possibleObjectNames: string[] | null;

    //Private methods
    private async LoadChoices()
    {
        this.possibleObjectNames = null;

        const parts = this.kvExternalId!.split("/");
        switch(this.input.objectType)
        {
            case "certificate":
            {
                const response = await this.apiService.resourceProviders._any_.securityservices.keyvault._any_.certificates.get(parts[1], parts[4]);
                const data = await this.apiResponseHandler.ExtractDataFromResponseOrShowErrorMessageOnError(response);
                if(data.ok)
                    this.possibleObjectNames = data.value.map(x => x.name);
                else
                    this.OnKeyVaultReferenceChanged(null);
            }
            break;
            case "key":
            {
                const response = await this.apiService.resourceProviders._any_.securityservices.keyvault._any_.keys.get(parts[1], parts[4]);
                const data = await this.apiResponseHandler.ExtractDataFromResponseOrShowErrorMessageOnError(response);
                if(data.ok)
                    this.possibleObjectNames = data.value.map(x => x.name);
                else
                    this.OnKeyVaultReferenceChanged(null);
            }
            break;
            case "secret":
            {
                const response = await this.apiService.resourceProviders._any_.securityservices.keyvault._any_.secrets.get(parts[1], parts[4]);
                const data = await this.apiResponseHandler.ExtractDataFromResponseOrShowErrorMessageOnError(response);
                if(data.ok)
                    this.possibleObjectNames = data.value.map(x => x.name);
                else
                    this.OnKeyVaultReferenceChanged(null);
            }
            break;
        }
    }

    private RenderObjectOptions()
    {
        if(this.possibleObjectNames === null)
            return [];
        return this.possibleObjectNames.map(x => <option selected={this.objectName === x}>{x}</option>)
    }

    private ValidateState()
    {
        if(this.input.value === null)
            this.objectName = null;
        else
        {
            const parts = this.input.value.split("/" + this.input.objectType + "s/");
            if(this.kvExternalId !== parts[0])
            {
                this.kvExternalId = parts[0];
                this.LoadChoices();
            }

            this.objectName = parts[1];
        }
    }

    //Event handlers
    override OnInitiated(): void
    {
        this.ValidateState();
    }

    override OnInputChanged(): void
    {
        this.ValidateState();
    }

    private async OnKeyVaultReferenceChanged(newValue: string | null)
    {
        this.kvExternalId = newValue;
        this.objectName = null;
        this.input.onChanged(null);

        if(this.kvExternalId !== null)
            this.LoadChoices();
    }

    private OnSecretSelectionChanged(newValue: string[])
    {
        this.objectName = newValue[0];
        const final = this.kvExternalId + "/" + this.input.objectType + "s/" + this.objectName;
        this.input.onChanged(final);
    }
}