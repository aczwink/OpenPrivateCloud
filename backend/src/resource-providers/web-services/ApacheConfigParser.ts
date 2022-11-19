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
import { VirtualHost } from "./VirtualHost";

enum TokenType
{
    Comment,
    EndElement,
    Identifier,
    Text,
}

interface StandardToken
{
    type: TokenType;
    data: string;
}

interface BeginElementToken
{
    type: "BeginElement";
    name: string;
    attribute: string;
}

type Token = StandardToken | BeginElementToken;

export interface ParsedDirectory
{
    path: string;
    properties: Dictionary<string>;
}

export class ApacheConfigParser
{
    constructor(private input: string)
    {
    }

    //Public methods
    public Parse()
    {
        return this.ParseNextTopLevelElement();
    }

    //Private methods
    private FetchNextToken(): Token
    {
        this.input = this.input.trimLeft();

        if(this.input.startsWith("</"))
        {
            const pos = this.input.indexOf(">");
            const tag = this.input.substring(2, pos);
            this.input = this.input.substring(pos + 2);

            return { type: TokenType.EndElement, data: tag };
        }
        else if(this.input.startsWith("<"))
        {
            const pos = this.input.indexOf(">");
            const elemData = this.input.substring(1, pos).trim();
            const nameMatch = elemData.match(/.+[ \t]/);
            const nameEndPos = nameMatch![0].length - 1;
            const name = elemData.substr(0, nameEndPos);

            this.input = this.input.substring(pos+1);

            return { type: "BeginElement", name, attribute: this.ParseAttribute(elemData.substr(nameEndPos + 1))};
        }

        if(this.input.startsWith("#"))
        {
            const commentMatch = this.input.match(/#.+[\r\n]/);
            const data = commentMatch![0];
            this.input = this.input.substring(data.length);
        
            return { type: TokenType.Comment, data: data.substr(1) };
        }

        const identifierMatch = this.input.match(/^[a-zA-Z]+[ \t]/);
        if(identifierMatch !== null)
        {
            this.input = this.input.substring(identifierMatch[0].length);
            return { type: TokenType.Identifier, data: identifierMatch[0].trimRight() };
        }

        const textMatch = this.input.match(/.+[ \t\n]/);
        const data = textMatch![0];
        this.input = this.input.substring(data.length);

        return { type: TokenType.Text, data: data.trimRight() };
    }

    private ParseAttribute(text: string): string
    {
        if(text.startsWith('"'))
            return text.substr(1, text.length - 2);
        return text;
    }

    private ParseDirectoryContents(path: string): ParsedDirectory
    {
        const data: Dictionary<string> = {};

        while(true)
        {
            const token = this.FetchNextToken();
            if(token.type === TokenType.EndElement)
            {
                if(token.data !== "Directory")
                    throw new Error("Expected Directory end element but got: " + token.data);
                break;
            }

            switch(token.type)
            {
                case TokenType.Identifier:
                    const kv = this.ParseKeyValue(token);
                    data[kv.key] = kv.value;
                    break;
                default:
                    throw new Error("Unhandled token: " + token.type);
            }
        }

        return {
            path,
            properties: data
        };
    }

    private ParseKeyValue(token: StandardToken)
    {
        const valueToken = this.FetchNextToken();
        if(valueToken.type !== TokenType.Text)
            throw new Error("Wrong data: " + valueToken);

        return { key: token.data, value: valueToken.data };
    }

    private ParseNextTopLevelElement()
    {
        const token = this.FetchNextToken();

        if( (token.type === "BeginElement") && (token.name === "VirtualHost") )
            return this.ParseVirtualHostBody(token.attribute);
        else
        {
            console.log(token);
            throw new Error("Method not implemented: " + token.type);
        }
    }

    private ParseVirtualHostBody(address: string)
    {
        const data: Dictionary<string> = {};
        const dirs = [];

        while(true)
        {
            const token = this.FetchNextToken();
            if(token.type === TokenType.EndElement)
            {
                if(token.data !== "VirtualHost")
                    throw new Error("Expected VirtualHost end element but got: " + token.data);
                break;
            }

            switch(token.type)
            {
                case "BeginElement":
                    if(token.name === "Directory")
                    {
                        const dir = this.ParseDirectoryContents(token.attribute);
                        dirs.push(dir);
                    }
                    else
                        throw new Error("Method not implemented");
                    break
                case TokenType.Comment:
                    break;
                case TokenType.Identifier:
                    const kv = this.ParseKeyValue(token);
                    data[kv.key] = kv.value;
                    break;
                default:
                    throw new Error("Unhandled token: " + token.data);
            }
        }

        return VirtualHost.FromConfigObject(address, data, dirs);
    }
}