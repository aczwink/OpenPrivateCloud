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

import { InfoMessageManager, RootInjector } from "acfrontend";
import { ResponseData } from "../../dist/api";

export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

async function ExtractErrorMessageFromRawBody(rawBody: any)
{
    if(rawBody instanceof Blob)
        return await rawBody.text();
    return rawBody;
}

async function ExtractDataOrErrorFromResponse<ObjectType>(response: ResponseData<number, number, ObjectType>): Promise<Result<ObjectType>>
{
    switch(response.statusCode)
    {
        case 200:
            return { ok: true, value: (response as any).data };
        case 204:
            return { ok: true, value: undefined as any };
        case 400:
        case 403:
        case 404:
        case 409:
        case 500:
            return { ok: false, error: await ExtractErrorMessageFromRawBody(response.rawBody) };
        default:
            alert("unhandled status code: " + response.statusCode);
            throw new Error("unhandled status code: " + response.statusCode);
    }
}

export async function ExtractDataFromResponseOrShowErrorMessageOnError<ObjectType>(response: ResponseData<number, number, ObjectType>): Promise<Result<ObjectType>>
{
    const result = await ExtractDataOrErrorFromResponse(response);

    if(!result.ok)
    {
        const imm = RootInjector.Resolve(InfoMessageManager);
        imm.ShowMessage(result.error, {
            type: "danger",
            duration: 10000
        });
    }

    return result;
}

export function ShowErrorMessageOnErrorFromResponse(response: ResponseData<number, number, any>)
{
    ExtractDataFromResponseOrShowErrorMessageOnError(response);
}

export async function UnwrapResponse<ErrorCodes, ResultType, UnwrappedType>(promise: Promise<ResponseData<200, ErrorCodes, ResultType>>, unwrapper: (x: ResultType) => UnwrappedType): Promise<ResponseData<200, ErrorCodes, UnwrappedType>>
{
    const response = await promise;
    if(response.statusCode === 200)
    {
        return {
            data: unwrapper((response as any).data),
            rawBody: response.rawBody,
            statusCode: response.statusCode as any
        };
    }
    return {
        rawBody: response.rawBody,
        statusCode: response.statusCode
    };
}