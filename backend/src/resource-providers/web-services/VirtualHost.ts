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
import { ParsedDirectory } from "./ApacheConfigParser";

interface SSLModuleProperties
{
    certificateFile: string;
    keyFile: string;
}

interface VirtualHostDirectory
{
    path: string;
    allowOverride?: "All";
    fallbackResource?: string;
    options?: "FollowSymLinks MultiViews";
    require?: "all granted";
    moduleConditionals?: { moduleName: string; content: string }[];
}

interface VirtualHostProperties
{
    serverAdmin: string;
    documentRoot: string;
    errorLog: string;
    customLog: string;

    mod_ssl?: SSLModuleProperties;
}

export class VirtualHost
{
    constructor(addresses: string, properties: VirtualHostProperties, directories: VirtualHostDirectory[])
    {
        this._addresses = addresses;
        this._properties = properties;
        this._directories = directories;
    }

    //Properties
    public get addresses()
    {
        return this._addresses;
    }
    
    public get directories()
    {
        return this._directories;
    }

    public set directories(newValue: VirtualHostDirectory[])
    {
        this._directories = newValue;
    }
    
    public get properties()
    {
        return this._properties;
    }

    //Public methods
    public ToConfigString()
    {
        let result = `<VirtualHost ${this._addresses}>
    ServerAdmin ${this._properties.serverAdmin}
    DocumentRoot ${this._properties.documentRoot}
    
    ErrorLog ${this._properties.errorLog}
    CustomLog ${this._properties.customLog}\n`;

        if(this._properties.mod_ssl !== undefined)
        {
            result += "\tSSLEngine on\n";
            result += "\tSSLCertificateFile " + this._properties.mod_ssl.certificateFile + "\n";
            result += "\tSSLCertificateKeyFile " + this._properties.mod_ssl.keyFile + "\n";
        }

        for (const dir of this._directories)
        {
            result += '\n\t<Directory "' + dir.path + '">\n';
            result += this.DirectoryContentsToConfigString(dir);
            result += '\n\t</Directory>\n';
        }

        result += `
</VirtualHost>

# vim: syntax=apache ts=4 sw=4 sts=4 sr noet
`;
        return result;
    }

    //Class functions
    public static Default(addresses: string, serverAdmin: string)
    {
        if(serverAdmin.trim().length === 0)
            serverAdmin = "webmaster@localhost";
        return new VirtualHost(addresses, {
            serverAdmin,
            documentRoot: "/usr/local/apache/htdocs",
            errorLog: "${APACHE_LOG_DIR}/error.log",
            customLog: "${APACHE_LOG_DIR}/access.log combined",
        }, []);
    }

    public static FromConfigObject(addresses: string, properties: Dictionary<string>, dirs: ParsedDirectory[])
    {
        const vh = this.Default(addresses, properties.ServerAdmin!);
        const p = vh.properties;

        p.serverAdmin = properties.ServerAdmin!;
        p.documentRoot = properties.DocumentRoot!;
        p.errorLog = properties.ErrorLog!;
        p.customLog = properties.CustomLog!;

        if(properties.SSLEngine === "on")
        {
            p.mod_ssl = {
                certificateFile: properties.SSLCertificateFile!,
                keyFile: properties.SSLCertificateKeyFile!
            };
        }

        vh._directories = dirs.map(this.ParsedDirectoryToDirectory.bind(this));

        return vh;
    }

    //Private variables
    private _addresses: string;
    private _properties: VirtualHostProperties;
    private _directories: VirtualHostDirectory[];

    //Private methods
    private DirectoryContentsToConfigString(dir: VirtualHostDirectory)
    {
        const props = [
            this.OptionalToString("AllowOverride", dir.allowOverride),
            this.OptionalToString("FallbackResource", dir.fallbackResource),
            this.OptionalToString("Options", dir.options),
            this.OptionalToString("Require", dir.require),
        ].Values()
            .Filter(x => x.length > 0)
            .Map(x => "\t\t" + x)
            .Join("\n");

        return props + "\n" + this.ModuleConditionalsToString(dir.moduleConditionals);
    }

    private ModuleConditionalsToString(moduleConditionals: { moduleName: string; content: string; }[] | undefined)
    {
        if(moduleConditionals === undefined)
            return "";
        
        return moduleConditionals.Values()
            .Map(x => "<IfModule " + x.moduleName + ">\n" + x.content + "\n" + "</IfModule>")
            .Join("\n");
    }


    private OptionalToString(propName: string, value?: string)
    {
        if(value === undefined)
            return "";
        return propName + " " + value;
    }

    //Private class functions
    private static ParsedDirectoryToDirectory(dir: ParsedDirectory): VirtualHostDirectory
    {
        return {
            path: dir.path,
            fallbackResource: dir.properties.FallbackResource,
        };
    }
}