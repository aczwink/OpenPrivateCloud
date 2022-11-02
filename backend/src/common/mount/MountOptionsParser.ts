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

import { APISchemaService } from "../../services/APISchemaService";
import { FileSystemIndependentMountOptions, FileSystemTypeAndOptions, MountableBy } from "./MountOptions";

export class MountOptionsParser
{
    constructor(private apiSchemaService: APISchemaService)
    {
    }
    
    //Public methods
    public MapOptions(fsType: string, optionsString: string): FileSystemTypeAndOptions
    {
        const recognizedGeneralOptions = ["noauto", "user"].Values().ToSet();

        const options = optionsString.split(",");
        const generalOptions = this.MapFileSystemIndependentOptions(options.Values().Filter(x => recognizedGeneralOptions.has(x)).ToArray());
        const specificOptions = options.Values().Filter(x => !recognizedGeneralOptions.has(x)).ToArray();

        switch(fsType)
        {
            case "cifs":
                return this.MapCIFSOptions(generalOptions, specificOptions);
            default:
                return {
                    type: "unknown",
                    fsType,
                    ...generalOptions,
                    fileSystemSpecificOptions: specificOptions
                };
        }
    }

    //Private methods
    private MapCIFSOptions(generalOptions: FileSystemIndependentMountOptions, specificOptions: string[]): FileSystemTypeAndOptions
    {
        let userName = "";
        let password = "";
        let domain = "";

        for (const option of specificOptions)
        {
            switch(option)
            {
                default:
                    throw new Error(option);
            }
        }

        return {
            type: "cifs",
            ...generalOptions,
            userName,
            password,
            domain,
        };
    }

    private MapFileSystemIndependentOptions(options: string[]): FileSystemIndependentMountOptions
    {
        const base: FileSystemTypeAndOptions = this.apiSchemaService.CreateDefault(this.apiSchemaService.GetSchema("FileSystemTypeAndOptions"));
        const result: FileSystemIndependentMountOptions = {
            autoMount: base.autoMount,
            mountableBy: base.mountableBy,
            writable: base.writable
        };

        for (const option of options)
        {
            switch(option)
            {
                case "noauto":
                    result.autoMount = false;
                    break;
                case "user":
                    result.mountableBy = MountableBy.AnyUserBecomesOwner;
                    break;
                default:
                    throw new Error(option);
            }
        }

        return result;
    }
}