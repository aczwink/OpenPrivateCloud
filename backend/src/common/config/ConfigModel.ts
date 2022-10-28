/**
 * OpenPrivateCloud
 * Copyright (C) 2019-2022 Amir Czwink (amir130@hotmail.de)
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

import { Dictionary } from "acts-util-core";
import { ConfigEntry, KeyValueEntry, PropertyType } from "./ConfigParser";

export type Section = Dictionary<KeyValueEntry>;

interface SectionInsertPosition
{
    entries: ConfigEntry[];
    before: ConfigEntry | undefined;
}

interface SectionRange
{
    from: ConfigEntry;
    to: ConfigEntry;
    source: ConfigEntry[];
}

export class ConfigModel
{
    constructor(entries: ConfigEntry[])
    {
        this.sections = {};
        this.sectionInsertPositions = {};
        this.newSectionInsertPos = {
            entries,
            before: undefined,
        };
        this.sectionRanges = {};

        this.FindKeyValueEntries(entries);
    }

    //Properties
    public get sectionNames()
    {
        return this.sections.OwnKeys();
    }

    //Public methods
    public AsDictionary()
    {
        return this.sections.OwnKeys().ToDictionary(key => key, key => this.SectionAsDictionary(key.toString()));
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
            {
                const from = range.source.indexOf(range.from);
                const to = range.source.lastIndexOf(range.to);
                for(let i = to; i >= from; i--)
                    range.source.Remove(i);
            }

            delete this.sectionRanges[sectionName];
        }

        delete this.sections[sectionName];
        delete this.sectionInsertPositions[sectionName];
    }

    public SectionAsDictionary(sectionName: string)
    {
        const section = this.sections[sectionName];
        if(section === undefined)
            return {};
        return section.Values().ToDictionary(kvEntry => kvEntry!.key, kvEntry => kvEntry!.value);
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
            const insertPos = this.sectionInsertPositions[sectionName]!;
            if(insertPos === undefined)
            {
                console.log("skipping", sectionName, propertyName, value);
                return;
            }

            const newEntry: KeyValueEntry = {
                type: "KeyValue",
                key: propertyName,
                value
            };

            this.InsertEntry(insertPos, newEntry);
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
    private sectionInsertPositions: Dictionary<SectionInsertPosition>;
    private newSectionInsertPos: SectionInsertPosition;
    private sectionRanges: Dictionary<SectionRange[]>;

    //Private methods
    private EndSection(sectionName: string, before: ConfigEntry | undefined, entries: ConfigEntry[], from: ConfigEntry, to: ConfigEntry)
    {
        if(sectionName in this.sectionInsertPositions)
        {
            throw new Error("Duplicate insert pos for " + sectionName);
        }

        let beforeNext = undefined;
        if(before !== undefined)
        {
            let index = entries.indexOf(before);
            while( (index > 0) && entries[index-1].type !== "KeyValue")
                index--;

            before = entries[index];
            beforeNext = entries[index+1];
        }

        this.sectionInsertPositions[sectionName] = {
            entries,
            before
        };

        this.newSectionInsertPos = {
            entries,
            before: beforeNext,
        };

        let ranges = this.sectionRanges[sectionName];
        if(ranges === undefined)
            ranges = this.sectionRanges[sectionName] = [];
        ranges.push({
            from,
            to,
            source: entries
        });
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
                    this.EndSection(currentSectionName, entry, entries, firstEntry!, prevEntry!);

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
        this.EndSection(currentSectionName, undefined, entries, firstEntry!, prevEntry!);
    }

    private InsertEntry(insertPos: SectionInsertPosition, newEntry: ConfigEntry)
    {
        if(insertPos.before === undefined)
            insertPos.entries.push(newEntry);
        else
        {
            const index = insertPos.entries.indexOf(insertPos.before);
            insertPos.entries.splice(index, 0, newEntry);
        }
    }

    private InsertEntries(insertPos: SectionInsertPosition, ...newEntries: ConfigEntry[])
    {
        for (const entry of newEntries)
            this.InsertEntry(insertPos, entry);
    }

    private InsertNewSection(sectionName: string): Section
    {
        this.InsertEntries(this.newSectionInsertPos,
            {
                type: "Text",
                textValue: ""
            },
            {
                type: "BeginSection",
                textValue: sectionName
            }
        );

        const newEntry: ConfigEntry = {
            type: "Text",
            textValue: ""
        };
        this.InsertEntry(this.newSectionInsertPos, newEntry);

        const pos: SectionInsertPosition = {
            entries: this.newSectionInsertPos.entries,
            before: newEntry
        };

        const section = {};
        this.sections[sectionName] = section;
        this.sectionInsertPositions[sectionName] = pos;
        return section;
    }
}