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

import { Injectable, Component, Textarea, JSX_CreateElement, FormField, ProgressSpinner, NumberSpinner, DatePicker, DateTimePicker } from "acfrontend";
import { APIService } from "../../Services/APIService";
import { DataQueryKeyEntry, DataQueryResponse, DataSourceSchema, SourceQueryOptions } from "../../../dist/api";
import { QueryLanguageParser } from "./QueryLanguageParser";

@Injectable
export class DataExplorerComponent extends Component<{ query?: string; }>
{
    constructor(private apiService: APIService)
    {
        super();

        this.query = "";
        this.result = {
            keys: [],
            values: []
        };
        this.options = {
            startTime: Date.now() - (1000 * 60 * 60 * 24),
            endTime: Date.now(),
            maxRecordCount: 1000
        };
    }
    
    protected override Render(): RenderValue
    {

        return <fragment>
            <FormField title="Query">
                <Textarea value={this.query} onChanged={newValue => this.query = newValue} rows={8} />
            </FormField>
            <div className="row">
                <div className="col">
                    <FormField title="Start time">
                        <DateTimePicker value={this.options.startTime} onChanged={newValue => this.UpdateAfter(() => this.options.startTime = newValue.valueOf())} />
                    </FormField>
                </div>
                <div className="col">
                    <FormField title="End time">
                        <DateTimePicker value={this.options.endTime} onChanged={newValue => this.UpdateAfter(() => this.options.endTime = newValue.valueOf())} />
                    </FormField>
                </div>
                <div className="col">
                    <FormField title="Source row count" description="Maximum number of rows that are read from source tables">
                        <NumberSpinner onChanged={newValue => this.options.maxRecordCount = newValue} step={100} value={this.options.maxRecordCount} />
                    </FormField>
                </div>
                <div className="col">
                    <button disabled={!this.IsValid()} type="button" className="btn btn-primary" onclick={this.ExecuteQuery.bind(this)}>Execute</button>
                </div>
            </div>
            {this.RenderTable()}
        </fragment>;
    }

    //Private state
    private query: string;
    private result: DataQueryResponse | null;
    private options: SourceQueryOptions;

    //Private methods
    private async ExecuteQuery()
    {
        this.result = null;

        const parser = new QueryLanguageParser();

        const response = await this.apiService.data.patch({
            queryPipeline: parser.ParseQuery(this.query),
            sourceQueryOptions: this.options
        });
        response.data.keys.SortBy(x => x.name);
        this.result = response.data;
    }

    private IsValid()
    {
        return this.options.startTime < this.options.endTime;
    }

    private RenderResultEntry(keys: DataQueryKeyEntry[], entry: object)
    {
        return <tr>
            {...keys.map(x => <td>{this.RenderValue((entry as any)[x.name], x.schema)}</td>)}
        </tr>;
    }

    private RenderTable()
    {
        if(this.result === null)
            return <ProgressSpinner />;

        return <table className="table table-striped table-hover table-sm table-bordered">
            <thead>
                <tr>
                    {this.result.keys.map(x => <th>{x.schema.title ?? x.name}</th>)}
                </tr>
            </thead>
            <tbody>
                {...this.result.values.map(this.RenderResultEntry.bind(this, this.result.keys))}
            </tbody>
            <caption>{this.result.values.length} rows.</caption>
        </table>;
    }

    private RenderValue(value: any, schema: DataSourceSchema)
    {
        switch(schema.dataType)
        {
            case "number":
            {
                switch(schema.format)
                {
                    case "date-time-us":
                        return new Date(value / 1000).toLocaleString() + "." + (value % 1000);
                }

                if(schema.valueMapping !== undefined)
                    return (schema.valueMapping as any)[value] ?? value;
            }
            case "string":
                return value;
        }
    }

    private UpdateAfter(f: () => void)
    {
        f();
        this.Update();
    }

    //Event handlers
    override OnInitiated(): void
    {
        if(this.input.query !== undefined)
        {
            this.query = this.input.query.split("\n").map(x => x.trim()).filter(x => x.length > 0).join("\n");
            this.ExecuteQuery();
        }
    }
}