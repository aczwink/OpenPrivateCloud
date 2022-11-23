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

export interface Certificate
{
    name: string;
    expiryDate: Date;
    certificatePath: string;
    privateKeyPath: string;
}

export class CertBotListParser
{
    //Public methods
    public Parse(stdOut: string)
    {
        const certs: Certificate[] = [];

        const lines = stdOut.split("\n");
        while(lines.length > 0)
        {
            const cert = this.ParseCertificate(lines);
            if(cert !== undefined)
                certs.push(cert);
        }

        return certs;
    }

    //Private methods
    private ParseCertificate(lines: string[]): Certificate | undefined
    {
        const raw = this.ParseCertificateRaw(lines);
        if(raw === undefined)
            return undefined;

        const expiry = raw["Expiry Date"]!.split(" ");

        return {
            name: raw["Certificate Name"]!,
            certificatePath: raw["Certificate Path"]!,
            privateKeyPath: raw["Private Key Path"]!,
            expiryDate: new Date(expiry[0] + " " + expiry[1])
        };
    }

    private ParseCertificateRaw(lines: string[]): Dictionary<string> | undefined
    {
        const prop = this.TryParseProperty(lines);
        if(prop === undefined)
            return undefined;
        if(prop === null)
            return this.ParseCertificateRaw(lines);

        if(prop.propName === "Certificate Name")
        {
            const result: Dictionary<string> = {};
            result[prop.propName] = prop.propValue;

            while(true)
            {
                const currentLine = lines[0];
                const prop = this.TryParseProperty(lines);

                if(prop === undefined)
                    return result;
                if(prop === null)
                    return result;
                if(prop.propName === "Certificate Name")
                {
                    lines.unshift(currentLine);
                    return result;
                }
                result[prop.propName] = prop.propValue;
            }
        }

        return this.ParseCertificateRaw(lines);
    }

    private TryParseProperty(lines: string[])
    {
        const line = lines.shift();
        if(line === undefined)
            return undefined;

        const pos = line.indexOf(":");
        if(pos === -1)
            return null;

        const propName = line.substring(0, pos).trimStart();
        const propValue = line.substring(pos + 1).trim();

        return {
            propName,
            propValue
        };
    }
}