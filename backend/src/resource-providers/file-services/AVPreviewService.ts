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
import path from "path";
import { Injectable } from "acts-util-node";
import { MountsManager } from "../../services/MountsManager";
import { RemoteCommandExecutor } from "../../services/RemoteCommandExecutor";
import { CodecService, FFProbe_MediaInfo } from "../multimedia-services/CodecService";
import { RemoteFileSystemManager } from "../../services/RemoteFileSystemManager";

@Injectable
export class AVPreviewService
{
    constructor(private mountsManager: MountsManager, private remoteCommandExecutor: RemoteCommandExecutor, private codecService: CodecService, private remoteFileSystemsManager: RemoteFileSystemManager)
    {
        this.hostId = 0;
        this.tmpFs = null;
    }

    //Public methods
    public async CreateImageThumb(inputPath: string, mediaInfo: FFProbe_MediaInfo)
    {
        const vidStream = this.codecService.GetVideoStream(mediaInfo);
        const isWidthBigger = vidStream.width > vidStream.height;
        const scale = isWidthBigger ? "256:-1" : "-1:256";

        return await this.CreateImageThumbnail(inputPath, scale);
    }

    public async CreateVideoPreview(inputPath: string, mediaInfo: FFProbe_MediaInfo, thumbType: "preview" | "thumb" | "tiles"): Promise<string>
    {
        const vidStream = this.codecService.GetVideoStream(mediaInfo);
        const isWidthBigger = vidStream.width > vidStream.height;
        const scale = isWidthBigger ? "256:-1" : "-1:256";

        const duration = parseFloat(mediaInfo.format.duration);

        const parts = vidStream.r_frame_rate.split("/");
        const frameRate = parseInt(parts[0]) / parseInt(parts[1]);

        switch(thumbType)
        {
            case "preview":
                return await this.CreatePreviewVideo(inputPath, duration, scale);
            case "thumb":
                return await this.CreateImageThumbnail(inputPath, scale, 0.2 * duration);
            case "tiles":
                return await this.CreateTilesImage(inputPath, duration, frameRate, scale);
        }
    }

    public async CreateWorkspace(hostId: number, inputSize: number)
    {
        this.hostId = hostId;
        const inputSizeInMiB = Math.max((inputSize / 1024 / 1024), 1);
        this.tmpFs = await this.mountsManager.CreateTemporaryFileSystem(hostId, Math.round(inputSizeInMiB * 8));
        return this.tmpFs.mountPoint;
    }

    public async ReleaseWorkspace()
    {
        await this.tmpFs!.Release();
    }

    //State
    private hostId: number;
    private tmpFs: { mountPoint: string; Release: () => Promise<void>; } | null;

    private async CreateImageThumbnail(inputPath: string, scale: string, seekTo?: number)
    {
        const outPath = path.join(this.tmpFs!.mountPoint, "thumb.jpg");
        const seekParams = (seekTo === undefined) ? [] : [ "-ss", seekTo.toString()];
        await this.remoteCommandExecutor.ExecuteCommand(["ffmpeg", ...seekParams, "-i", inputPath, "-vf", "scale=" + scale, "-frames:v", "1", outPath], this.hostId);

        return outPath;
    }

    private async CreatePreviewVideo(inputPath: string, duration: number, scale: string)
    {
        const segmentsPath = path.join(this.tmpFs!.mountPoint, "segments");
        await this.remoteFileSystemsManager.CreateDirectory(this.hostId, segmentsPath);

        const segmentsCount = 5;
        const segmentLength = 4;
        const partitionLength = duration / segmentsCount;

        const h264baselineArgs = [
            "-vcodec", "libx264",
            "-pix_fmt", "yuv420p",
            "-profile:v", "baseline",
            "-level", "3",
            "-preset", "medium",
        ];

        for(let i = 0; i < segmentsCount; i++)
        {
            const partitionBegin = i * partitionLength;
            const partitionMiddle = partitionBegin + partitionLength / 2;

            const startSeek = partitionMiddle - (segmentLength / 2);

            const segmentPath = path.join(segmentsPath, i + ".mkv");
            await this.remoteCommandExecutor.ExecuteCommand(
                [
                    "ffmpeg",
                    "-ss", startSeek.toString(),
                    "-t", segmentLength.toString(),
                    "-i", inputPath,
                    ...h264baselineArgs,
                    segmentPath
                ],
            this.hostId);
        }

        const concatPath = path.join(this.tmpFs!.mountPoint, "concatlist.txt");
        let lines = [];
        for(let i = 0; i < segmentsCount; i++)
        {
            const segmentPath = path.join(segmentsPath, i + ".mkv");
            lines.push("file " + segmentPath);
        }
        await this.remoteFileSystemsManager.WriteTextFile(this.hostId, concatPath, lines.join("\n"));

        const outPath = path.join(this.tmpFs!.mountPoint, "preview.mp4");
        await this.remoteCommandExecutor.ExecuteCommand(
            [
                "ffmpeg",
                "-f", "concat",
                "-safe", "0",
                "-i", concatPath,

                "-vf", '"' + "scale=" + scale + ",pad=ceil(iw/2)*2:ceil(ih/2)*2" + '"',
                ...h264baselineArgs,
                outPath
            ],
        this.hostId);

        return outPath;
    }

    private async CreateTilesImage(inputPath: string, duration: number, frameRate: number, scale: string)
    {
        const outPath = path.join(this.tmpFs!.mountPoint, "tiles.jpg");
        const startSeek = (0.05 * duration);
        const tilesCount = 6*6;
        const frameMod = Math.floor((duration - startSeek) * frameRate / tilesCount);
        await this.remoteCommandExecutor.ExecuteCommand(
            [
                "ffmpeg",
                "-ss", startSeek.toString(),
                "-i", inputPath,
                "-vf", '"' + "select='not(mod(n," + frameMod + "))',scale=" + scale + ",tile=6x6" + '"',
                "-qscale:v", "2",
                "-frames:v", "1",
                outPath
            ],
        this.hostId);

        return outPath;
    }
}