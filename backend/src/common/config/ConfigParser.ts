/**
 * OpenPrivateCloud
 * Copyright (C) 2019-2023 Amir Czwink (amir130@hotmail.de)
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
import * as path from "path";
import { GlobalInjector } from "acts-util-node";
import { RemoteFileSystemManager } from "../../services/RemoteFileSystemManager";
import { ConfigDialect } from "./ConfigDialect";

export type PropertyType = boolean | null | number | string;

export interface KeyValueEntry
{
    type: "KeyValue";
    key: string;
    value: PropertyType;
}

interface IncludeDirEntry
{
    type: "IncludeDir";
    path: string;
    entries: {
        fileName: string;
        entries: ConfigEntry[];
    }[];
}

interface TextConfigEntry
{
    type: "BeginSection" | "Text";
    textValue: string;
}

export type ConfigEntry = IncludeDirEntry | KeyValueEntry | TextConfigEntry;

export class ConfigParser
{
    constructor(private dialect: ConfigDialect)
    {
        this.entriesStack = [];
    }
    
    //Public methods
    public async Parse(hostId: number, filePath: string): Promise<ConfigEntry[]>
    {
        const rfsm = GlobalInjector.Resolve(RemoteFileSystemManager);
        const stat = await rfsm.QueryStatus(hostId, filePath);
        if(stat.isSymbolicLink())
            return this.Parse(hostId, await rfsm.ReadLink(hostId, filePath));

        const entries: ConfigEntry[] = [];
        this.entriesStack.push(entries);

        const data = await rfsm.ReadTextFile(hostId, filePath);
        const lines = data.split("\n");

        for (const line of lines)
        {
            await this.ParseLine(hostId, line);
        }

        this.entriesStack.pop();
        return entries;
    }

    //Protected methods
    protected FileNameMatchesIncludeDir(fileName: string): boolean
    {
        return false;
    }

    protected ParseIncludeDir(line: string): string | undefined
    {
        return undefined;
    }
    
    protected ParseKeyValue(line: string): KeyValueEntry
    {
        const parts = line.split("=");
        let value: PropertyType;
        if(parts.length === 1)
            value = null;
        else if(parts.length != 2)
            throw new Error("Illegal data: " + line);
        else
            value = parts[1].trimLeft();

        return {
            type: "KeyValue",
            key: parts[0].trim(),
            value
        };
    }

    //Private members
    private entriesStack: ConfigEntry[][];

    //Private methods
    private AddEntry(entry: ConfigEntry)
    {
        this.entriesStack[this.entriesStack.length-1].push(entry);
    }

    private IsCommentLine(line: string)
    {
        for (const commentInitiator of this.dialect.commentInitiators)
        {
            if(line.startsWith(commentInitiator))
                return true;
        }
        return false;
    }

    private ParseKeyValueEntry(line: string): KeyValueEntry
    {
        const entry = this.ParseKeyValue(line);

        let value = entry.value;
        const asNum = typeof value === "string" ? parseInt(value) : NaN;
        if( !isNaN(asNum) && (asNum.toString() === value))
            value = asNum;

        if(value === this.dialect.boolMapping?.falseMapping)
            value = false;
        else if(value === this.dialect.boolMapping?.trueMapping)
            value = true;

        return {
            type: "KeyValue",
            key: entry.key,
            value
        };
    }

    private async ParseLine(hostId: number, line: string)
    {
        if(line.trim().length === 0)
            this.AddEntry({ type: "Text", textValue: line });
        else if(this.IsCommentLine(line))
            this.AddEntry({ type: "Text", textValue: line });
        else if(line.startsWith("["))
        {
            const sectionName = line.substr(1, line.length - 2);
            this.AddEntry({ type: "BeginSection", textValue: sectionName });
        }
        else
        {
            const dirPath = this.ParseIncludeDir(line);
            if(dirPath !== undefined)
                await this.ResolveDir(hostId, dirPath);
            else
                this.AddEntry(this.ParseKeyValueEntry(line));
        }
    }

    private async ResolveDir(hostId: number, dirPath: string)
    {
        const children = await GlobalInjector.Resolve(RemoteFileSystemManager).ListDirectoryContents(hostId, dirPath);

        const subEntries = [];
        for (const child of children)
        {
            const childPath = path.join(dirPath, child);
            const entries = await this.Parse(hostId, childPath);

            if(this.FileNameMatchesIncludeDir(child))
                subEntries.push({ fileName: child, entries });
        }

        this.AddEntry({ type: "IncludeDir", path: dirPath, entries: subEntries});
    }
}