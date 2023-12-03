/**
 * OpenPrivateCloud
 * Copyright (C) 2023 Amir Czwink (amir130@hotmail.de)
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

import { Injectable, Component, Textarea, JSX_CreateElement, FormField, ProgressSpinner } from "acfrontend";
import { APIService } from "../../Services/APIService";
import { DataQueryKeyEntry, DataQueryResponse } from "../../../dist/api";
import { QueryLanguageParser } from "./QueryLanguageParser";

@Injectable
export class DataExplorerComponent extends Component
{
    constructor(private apiService: APIService)
    {
        super();

        this.query = "";
        this.result = {
            keys: [],
            values: []
        };
    }
    
    protected override Render(): RenderValue
    {
        return <fragment>
            <div className="row">
                <div className="col">
                    <FormField title="Query">
                        <Textarea value={this.query} onChanged={newValue => this.query = newValue} rows={8} />
                    </FormField>
                </div>
                <div className="col-auto">
                    <button type="button" className="btn btn-primary" onclick={this.ExecuteQuery.bind(this)}>Execute</button>
                </div>
            </div>
            {this.RenderTable()}
        </fragment>;
    }

    //Private state
    private query: string;
    private result: DataQueryResponse | null;

    //Private methods
    private async ExecuteQuery()
    {
        this.result = null;

        const parser = new QueryLanguageParser();

        const response = await this.apiService.data.patch(parser.ParseQuery(this.query));
        response.data.keys.SortBy(x => x.name);
        this.result = response.data;
    }

    private RenderResultEntry(keys: DataQueryKeyEntry[], entry: object)
    {
        return <tr>
            {...keys.map(x => <td>{(entry as any)[x.name]}</td>)}
        </tr>;
    }

    private RenderTable()
    {
        if(this.result === null)
            return <ProgressSpinner />;

        return <table className="table table-striped table-hover table-sm table-bordered">
            <thead>
                <tr>
                    {this.result.keys.map(x => <th>{x.name}</th>)}
                </tr>
            </thead>
            <tbody>
                {...this.result.values.map(this.RenderResultEntry.bind(this, this.result.keys))}
            </tbody>
            <caption>{this.result.values.length} rows.</caption>
        </table>;
    }
}