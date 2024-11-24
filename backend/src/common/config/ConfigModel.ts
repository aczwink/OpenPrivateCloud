/**
 * OpenPrivateCloud
 * Copyright (C) 2019-2024 Amir Czwink (amir130@hotmail.de)
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

import { Dictionary, ObjectExtensions } from "acts-util-core";
import { ConfigEntry, KeyValueEntry, PropertyType } from "./ConfigParser";

export type Section = Dictionary<KeyValueEntry>;

class SectionRange
{
    constructor(private from: ConfigEntry, private to: ConfigEntry, private _source: ConfigEntry[])
    {
    }

    //Properties
    public get entriesCount()
    {
        return this.toIndex - this.fromIndex;
    }

    public get source()
    {
        return this._source;
    }

    public get toIndex()
    {
        return this._source.lastIndexOf(this.to);
    }

    //Public methods
    public AppendEntry(newEntry: ConfigEntry)
    {
        const insertIndex = this.nonEmptyEndIndex;
        this._source.splice(insertIndex + 1, 0, newEntry);

        if(this._source[insertIndex] === this.to)
            this.to = newEntry;
    }

    public FilterOut(match: (entry: ConfigEntry) => boolean)
    {
        const fromIdx = this.fromIndex;
        const toIdx = this.toIndex;
        
        for(let i = toIdx; i >= fromIdx; i--)
        {
            const entry = this._source[i];
            if(match(entry))
            {
                this.Remove(i);
            }
        }
    }

    public RemoveAll()
    {
        const fromIdx = this.fromIndex;
        const toIdx = this.toIndex;

        for(let i = toIdx; i >= fromIdx; i--)
            this.Remove(i);
    }

    //Private properties
    private get fromIndex()
    {
        return this._source.indexOf(this.from);
    }

    private get nonEmptyEndIndex()
    {
        const startIndex = this.fromIndex;
        let index = this.toIndex;
        while( (index > startIndex) && (this._source[index].type !== "KeyValue"))
            index--;

        return index;
    }

    //Private methods
    private Remove(index: number)
    {
        if(this.to === this._source[index])
            this.to = this._source[index - 1];
        this._source.Remove(index);
    }
}

export class ConfigModel
{
    constructor(entries: ConfigEntry[])
    {
        this.sections = {};
        this.sectionRanges = {};

        const lastEntry = entries[entries.length - 1];
        this.newestSectionRange = new SectionRange(lastEntry, lastEntry, entries);

        this.FindKeyValueEntries(entries);
    }

    //Properties
    public get sectionNames()
    {
        return ObjectExtensions.OwnKeys(this.sections);
    }

    //Public methods
    public AsDictionary()
    {
        return ObjectExtensions.OwnKeys(this.sections).ToDictionary(key => key, key => this.SectionAsDictionary(key.toString()));
    }

    public DeleteProperties(sectionName: string, propertyNames: string[])
    {
        for (const propertyName of propertyNames)
            this.DeleteProperty(sectionName, propertyName);
    }

    public DeleteProperty(sectionName: string, propertyName: string)
    {
        const section = this.sections[sectionName];
        if(section === undefined)
            return;

        const ranges = this.sectionRanges[sectionName];
        if(ranges !== undefined)
        {
            for (const range of ranges)
                range.FilterOut(entry => (entry.type === "KeyValue") && (entry.key === propertyName) );
        }

        delete section[propertyName];
    }

    public DeleteSection(sectionName: string)
    {
        const section = this.sections[sectionName];
        if(section === undefined)
            return;

        const ranges = this.sectionRanges[sectionName];
        if(ranges !== undefined)
        {
            for (const range of ranges)
                range.RemoveAll();

            delete this.sectionRanges[sectionName];
        }

        delete this.sections[sectionName];
    }

    public GetProperty(sectionName: string, propertyName: string)
    {
        const section = this.sections[sectionName];
        if(section === undefined)
            return undefined;

        const entry = section[propertyName];
        return entry?.value;
    }

    public SectionAsDictionary(sectionName: string)
    {
        const section = this.sections[sectionName];
        if(section === undefined)
            return {};
        return ObjectExtensions.Values(section).ToDictionary(kvEntry => kvEntry!.key, kvEntry => kvEntry!.value);
    }

    public SetProperties(sectionName: string, props: Dictionary<PropertyType>)
    {
        for (const key in props)
        {
            if (Object.prototype.hasOwnProperty.call(props, key))
            {
                this.SetProperty(sectionName, key, props[key] as PropertyType);
            }
        }
    }

    public SetProperty(sectionName: string, propertyName: string, value: PropertyType)
    {
        let section = this.sections[sectionName];
        if(section === undefined)
            section = this.InsertNewSection(sectionName);

        const entry = section[propertyName];
        if(entry === undefined)
        {
            const insertRange = this.FindBestInsertRange(sectionName);

            const newEntry: KeyValueEntry = {
                type: "KeyValue",
                key: propertyName,
                value
            };

            insertRange.AppendEntry(newEntry);
            section[propertyName] = newEntry;
        }
        else
            entry.value = value;
    }

    public WithoutSectionAsDictionary()
    {
        return this.SectionAsDictionary("");
    }

    //Private variables
    private sections: Dictionary<Section>;
    private newestSectionRange: SectionRange;
    private sectionRanges: Dictionary<SectionRange[]>;

    //Private methods
    private AddSectionRange(sectionName: string, newRange: SectionRange)
    {
        let ranges = this.sectionRanges[sectionName];
        if(ranges === undefined)
            ranges = this.sectionRanges[sectionName] = [];
        ranges.push(newRange);
    }

    private FindBestInsertRange(sectionName: string)
    {
        const ranges = this.sectionRanges[sectionName]!;
        return ranges.Values().OrderByDescending(x => x.entriesCount).First();
    }
    
    private FindKeyValueEntries(entries: ConfigEntry[])
    {
        let currentSectionName = "";
        let firstEntry: ConfigEntry | undefined = undefined;
        let prevEntry: ConfigEntry | undefined = undefined;

        for (const entry of entries)
        {
            switch(entry.type)
            {
                case "BeginSection":
                    this.InserSectionRange(currentSectionName, entries, firstEntry!, prevEntry!);

                    currentSectionName = entry.textValue;
                    this.sections[currentSectionName] = {};
                    firstEntry = entry;
                    break;
                case "IncludeDir":
                    entry.entries.forEach(fileEntries => this.FindKeyValueEntries(fileEntries.entries));
                    break;
                case "KeyValue":
                    let section = this.sections[currentSectionName];
                    if((section === undefined) && (currentSectionName === ""))
                    {
                        section = this.sections[currentSectionName] = {};
                        firstEntry = entry;
                    }
                    section![entry.key] = entry;
                    break;
            }

            prevEntry = entry;
        }
        this.InserSectionRange(currentSectionName, entries, firstEntry!, prevEntry!);
    }

    private InsertNewSection(sectionName: string): Section
    {
        const blankLine: ConfigEntry = {
            type: "Text",
            textValue: ""
        };

        this.newestSectionRange.AppendEntry(blankLine);

        const newSectionEntry: ConfigEntry = {
            type: "BeginSection",
            textValue: sectionName
        };

        const pos = this.newestSectionRange.toIndex;
        this.newestSectionRange.source.splice(pos + 1, 0, newSectionEntry);

        this.InserSectionRange(sectionName, this.newestSectionRange.source, newSectionEntry, newSectionEntry);
        this.newestSectionRange.AppendEntry(blankLine);

        const section = {};
        this.sections[sectionName] = section;
        return section;
    }

    private InserSectionRange(sectionName: string, entries: ConfigEntry[], from: ConfigEntry, to: ConfigEntry)
    {
        const newRange = new SectionRange(from, to, entries);
        this.AddSectionRange(sectionName, newRange);
        this.newestSectionRange = newRange;
    }
}