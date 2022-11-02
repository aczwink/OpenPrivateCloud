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

import { InfoMessageManager, RootInjector } from "acfrontend";
import { ResponseData } from "../../dist/api";

export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

function ExtractDataOrErrorFromResponse<ObjectType>(response: ResponseData<number, number, ObjectType>): Result<ObjectType>
{
    switch(response.statusCode)
    {
        case 200:
            return { ok: true, value: (response as any).data };
        case 204:
            return { ok: true, value: undefined as any };
        case 409:
            return { ok: false, error: response.rawBody };
        default:
            alert("unhandled status code: " + response.statusCode);
            throw new Error("unhandled status code: " + response.statusCode);
    }
}

export function ExtractDataFromResponseOrShowErrorMessageOnError<ObjectType>(response: ResponseData<number, number, ObjectType>): Result<ObjectType>
{
    const result = ExtractDataOrErrorFromResponse(response);

    if(!result.ok)
    {
        const imm = RootInjector.Resolve(InfoMessageManager);
        imm.ShowMessage(result.error, {
            duration: 10000
        });
    }

    return result;
}

export function ShowErrorMessageOnErrorFromResponse(response: ResponseData<number, number, any>)
{
    ExtractDataFromResponseOrShowErrorMessageOnError(response);
}