/**
 * OpenPrivateCloud
 * Copyright (C) 2022 Amir Czwink (amir130@hotmail.de)
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

import { Injectable } from "acts-util-node";
import { RemoteCommandExecutor } from "../../services/RemoteCommandExecutor";

export interface FFProbe_StreamInfo
{
    codec_name: string;
    codec_type: "video" | "audio";
    profile: string;
}

interface FFProbe_MediaInfo
{
    format: unknown;
    streams: FFProbe_StreamInfo[];
}

@Injectable
export class CodecService
{
    constructor(private remoteCommandExecutor: RemoteCommandExecutor)
    {
    }

    //Public methods
    public async AnalyzeMediaFile(hostId: number, mediaFilePath: string)
    {
        const result = await this.remoteCommandExecutor.ExecuteBufferedCommand(["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", mediaFilePath], hostId);

        return JSON.parse(result.stdOut) as FFProbe_MediaInfo;
    }
}