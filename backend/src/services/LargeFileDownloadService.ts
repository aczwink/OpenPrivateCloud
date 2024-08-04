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
import { OPCFormat_Header, OPCFormat_MaxHeaderLength, OPCFormat_ReadHeader, OPCFormat_SupportsRandomAccess, OPCFormat_SymmetricDecrypt, OPCFormat_SymmetricDecryptSlice, SymmetricKey } from "../common/crypto/symmetric";
import { ClusterEventsManager } from "./ClusterEventsManager";

interface RequestEntry
{
    createStreamCallBack: () => Promise<Readable>;
    readBlockCallBack: (start: number, end: number) => Promise<Buffer>;
    stream?: Readable;
    buffer: Buffer;
    bufferedCount: number;
    mediaType: string;
    header: OPCFormat_Header;
    totalSize: number;
    key: SymmetricKey;
}

interface RequestParameters
{
    userId: number;
    mediaType: string;
    totalSize: number;
    createStreamCallBack: () => Promise<Readable>;
    readBlockCallBack: (start: number, end: number) => Promise<Buffer>;
    key: SymmetricKey;
}

@Injectable
export class LargeFileDownloadService
{
    constructor(clusterEventsManager: ClusterEventsManager)
    {
        this.idMap = {};
        this.userIdMap = {};

        clusterEventsManager.RegisterListener(event => {
            if(event.type === "userLogOut")
                this.DeleteRequest(event.userId);
        })
    }

    public async CreateRequest(params: RequestParameters)
    {
        const headerBlock = await params.readBlockCallBack(0, OPCFormat_MaxHeaderLength);
        const header = OPCFormat_ReadHeader(headerBlock);
        const randomAccess = OPCFormat_SupportsRandomAccess(header);

        this.DeleteRequest(params.userId);
        const id = GenerateRandomUUID();

        this.idMap[id] = {
            totalSize: params.totalSize,
            mediaType: params.mediaType,
            createStreamCallBack: params.createStreamCallBack,
            buffer: Buffer.alloc(randomAccess ? 0 : params.totalSize),
            bufferedCount: 0,
            header,
            readBlockCallBack: params.readBlockCallBack,
            key: params.key
        };
        this.userIdMap[params.userId] = id;

        return id;
    }

    public async RequestPart(id: string, rangeHeader: string)
    {
        const request = this.idMap[id];
        if(request === undefined)
            return undefined;

        const parts = rangeHeader.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);

        const chunkSize = 4 * 1024 * 1024; //4 MiB
        const inclusiveEnd = parts[1] ? parseInt(parts[1], 10) : (start + chunkSize - 1);
        const rangedEnd = Math.min(inclusiveEnd, request.totalSize - 1);

        const randomAccess = OPCFormat_SupportsRandomAccess(request.header);
        const chunk = randomAccess
            ? await this.ReadSlice(request, start, rangedEnd - start + 1)
            : await this.ReadSliceFromBuffer(request, start, rangedEnd - start + 1);

        return {
            start,
            end: rangedEnd,
            data: chunk,
            mediaType: request.mediaType,
            totalSize: request.totalSize,
        };
    }

    public async RequestFull(id: string)
    {
        const request = this.idMap[id];
        if(request === undefined)
            return undefined;

        return {
            data: await request.createStreamCallBack(),
            mediaType: request.mediaType,
            totalSize: request.totalSize,
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

    private async ReadSlice(request: RequestEntry, offset: number, count: number)
    {
        const firstBlockNumber = Math.floor(offset / 16);
        const lastBlockNumber = Math.ceil((offset + count) / 16);

        const encryptedBlock = await request.readBlockCallBack(firstBlockNumber * 16 + request.header.headerLength, lastBlockNumber * 16 + request.header.headerLength);
        const decryptedBlock = OPCFormat_SymmetricDecryptSlice(request.key, request.header, firstBlockNumber, encryptedBlock);

        const startSkip = offset % 16;
        return decryptedBlock.subarray(startSkip, startSkip + count);
    }

    private async ReadSliceFromBuffer(request: RequestEntry, offset: number, count: number)
    {
        if(request.stream === undefined)
        {
            request.stream = await request.createStreamCallBack();
            request.stream.on("data", chunk => {
                request.buffer.fill(chunk, request.bufferedCount, request.bufferedCount + chunk.length);
                request.bufferedCount += chunk.length;
            });
        }

        while((offset + count) > request.bufferedCount)
            await TimeUtil.Delay(500);

        return request.buffer.subarray(offset, offset + count);
    }
}