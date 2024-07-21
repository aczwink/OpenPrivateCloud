/**
 * OpenPrivateCloud
 * Copyright (C) 2024 Amir Czwink (amir130@hotmail.de)
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

import { Dictionary, NumberDictionary, TimeUtil } from "acts-util-core";
import { Injectable } from "acts-util-node";
import { GenerateRandomUUID } from "../common/crypto/randomness";
import { Readable } from "stream";

interface RequestEntry
{
    createStreamCallBack: () => Promise<Readable>;
    stream?: Readable;
    offset: number;
    buffered: Buffer[];
    totalSize: number;
}

@Injectable
export class LargeFileDownloadService
{
    constructor()
    {
        this.idMap = {};
        this.userIdMap = {};
    }

    public CreateRequest(userId: number, totalSize: number, createStreamCallBack: () => Promise<Readable>)
    {
        this.DeleteRequest(userId);
        const id = GenerateRandomUUID();
        this.idMap[id] = { totalSize, createStreamCallBack: createStreamCallBack, offset: 0, buffered: [] };
        this.userIdMap[userId] = id;

        return id;
    }

    public async RequestPart(id: string, rangeHeader: string): Promise<{ start: number, end: number, totalSize: number, data: Buffer } | undefined>
    {
        const request = this.idMap[id];
        if(request === undefined)
            return undefined;

        const parts = rangeHeader.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);

        const chunkSize = 4 * 1024 * 1024; //4 MiB
        const inclusiveEnd = parts[1] ? parseInt(parts[1], 10) : (start + chunkSize - 1);
        const rangedEnd = Math.min(inclusiveEnd, request.totalSize - 1);

        if(request.stream === undefined)
        {
            request.stream = await request.createStreamCallBack();
            request.stream.on("data", chunk => {
                request.buffered.push(chunk);
                if(request.buffered.length > 100)
                    request.stream?.pause();
            });
        }

        const stream = request.stream;
        if(request.offset < start)
        {
            this.Skip(request, start - request.offset);
            request.offset = start;
        }
        else if(start < request.offset)
        {
            request.stream.pause();

            request.buffered = [];
            request.offset = 0;
            request.stream = undefined;
            return this.RequestPart(id, rangeHeader);
        }

        const chunk = await this.Read(request, rangedEnd - start + 1);
        request.offset += chunk.byteLength;
        request.stream = stream;

        return {
            start,
            end: rangedEnd,
            totalSize: request.totalSize,
            data: chunk
        };
    }

    public async RequestFull(id: string)
    {
        const request = this.idMap[id];
        if(request === undefined)
            return undefined;

        return {
            totalSize: request.totalSize,
            data: await request.createStreamCallBack()
        };
    }

    //Private state
    private idMap: Dictionary<RequestEntry>;
    private userIdMap: NumberDictionary<string>;

    //Private methods
    private DeleteRequest(userId: number)
    {
        const id = this.userIdMap[userId];
        if(id !== undefined)
            delete this.idMap[id];
        delete this.userIdMap[userId];
    }

    private async Read(request: RequestEntry, count: number)
    {
        const result = [];
        while(count > 0)
        {
            if(request.buffered.length < 100)
                request.stream?.resume();
            if(request.buffered.length === 0)
            {
                if(request.stream?.readableEnded)
                    break;
                await TimeUtil.Delay(500);
                continue;
            }

            const b = request.buffered[0];
            if(b.byteLength > count)
            {
                result.push(b.subarray(0, count));
                request.buffered[0] = b.subarray(count);
                break;
            }
            else
            {
                result.push(b);
                request.buffered.Remove(0);
                count -= b.byteLength;
            }
        }

        return Buffer.concat(result);
    }

    private Skip(request: RequestEntry, skip: number)
    {
        this.Read(request, skip);
    }
}
//TODO: session logout event