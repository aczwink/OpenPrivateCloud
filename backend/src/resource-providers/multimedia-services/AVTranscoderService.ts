/**
 * OpenPrivateCloud
 * Copyright (C) 2022-2024 Amir Czwink (amir130@hotmail.de)
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
import { AVTranscoderConfig, AVTranscoderFormat, AVTranscoderQuality } from "./AVTranscoderConfig";
import { FileStoragesManager } from "../file-services/FileStoragesManager";
import { CodecService, FFProbe_StreamInfo } from "./CodecService";
import { RemoteCommandExecutor } from "../../services/RemoteCommandExecutor";
import { ResourcesManager } from "../../services/ResourcesManager";
import { RemoteRootFileSystemManager } from "../../services/RemoteRootFileSystemManager";
import { EnumeratorBuilder } from "acts-util-core/dist/Enumeration/EnumeratorBuilder";
import { LightweightResourceReference } from "../../common/ResourceReference";
import { RemoteFileSystemManager } from "../../services/RemoteFileSystemManager";

@Injectable
export class AVTranscoderService
{
    constructor(private fileStoragesManager: FileStoragesManager, private codecService: CodecService, private remoteCommandExecutor: RemoteCommandExecutor, private resourcesManager: ResourcesManager,
        private remoteRootFileSystemManager: RemoteRootFileSystemManager, private remoteFileSystemManager: RemoteFileSystemManager)
    {
    }

    //Public methods
    public async Transcode(resourceReference: LightweightResourceReference, config: AVTranscoderConfig)
    {
        const sourceResourceRef = await this.resourcesManager.CreateResourceReferenceFromExternalId(config.source.sourceFileStorageExternalId);
        if(sourceResourceRef === undefined)
            throw new Error("Source file storage does not exist anymore!");

        const resourceDir = this.resourcesManager.BuildResourceStoragePath(resourceReference);

        const files = await this.ReadInputFiles(sourceResourceRef, config.source.sourcePath);

        const dataPath = this.fileStoragesManager.GetDataPath(sourceResourceRef);
        const targetPath = path.join(dataPath, config.targetPath);
        for (const file of files)
            await this.TranscodeFile(sourceResourceRef.hostId, file, config.format, resourceDir, targetPath);
    }

    //Private methods
    private ComputeQuality(codec: "aac" | "h264" | "h265" | "mp3" | "opus", quality: AVTranscoderQuality)
    {
        switch(codec)
        {
            case "aac":
                switch(quality)
                {
                    case AVTranscoderQuality.Transparent:
                        return "192k";
                    case AVTranscoderQuality.Standard:
                        return "128k";
                }

            case "h264":
                switch(quality)
                {
                    case AVTranscoderQuality.Transparent:
                        return 17;
                    case AVTranscoderQuality.Standard:
                        return 23;
                }

            case "h265":
                switch(quality)
                {
                    case AVTranscoderQuality.Transparent:
                        return 22;
                    case AVTranscoderQuality.Standard:
                        return 28;
                }
            case "mp3":
                switch(quality)
                {
                    case AVTranscoderQuality.Transparent:
                        return 0;
                    case AVTranscoderQuality.Standard:
                        return 4;
                }
            case "opus":
                switch(quality)
                {
                    case AVTranscoderQuality.Transparent:
                        throw new Error("not implemented");
                    case AVTranscoderQuality.Standard:
                        return "64k";
                }
        }
    }

    private GetAudioCodecParameters(targetFormat: AVTranscoderFormat, audioStreams: EnumeratorBuilder<FFProbe_StreamInfo>)
    {
        switch(targetFormat.audioCodec)
        {
            case "aac-lc":
                if(audioStreams.Map(x => (x.codec_name === "aac") && (x.profile === "LC")).All())
                    return ["-acodec", "copy"];

                return [
                    "-acodec", "aac",
                    "-b:a", this.ComputeQuality("aac", targetFormat.quality).toString()
                ];

            case "mp3":
                if(audioStreams.Map(x => x.codec_name === "mp3").All())
                    return ["-acodec", "copy"];

                return [
                    "-acodec", "libmp3lame",
                    "-q:a", this.ComputeQuality("mp3", targetFormat.quality).toString()
                ];

            case "opus":
                if(audioStreams.Map(x => x.codec_name === "opus").All())
                    return ["-acodec", "copy"];

                return [
                    "-acodec", "libopus",
                    "-b:a", this.ComputeQuality("opus", targetFormat.quality).toString()
                ];
        }
    }

    private GetContainerFormatParameters(targetFormat: AVTranscoderFormat)
    {
        switch(targetFormat.containerFormat)
        {
            case "mkv":
                return [];

            case "mp4":
                return ["-movflags", "+faststart"];
        }
    }

    private GetVideoCodecParameters(targetFormat: AVTranscoderFormat, videoStreams: EnumeratorBuilder<FFProbe_StreamInfo>)
    {
        switch(targetFormat.videoCodec)
        {
            case "h264-baseline":
                if(videoStreams.Map(x => (x.codec_name === "h264") && (x.profile === "Constrained Baseline")).All())
                    return ["-vcodec", "copy"];

                return [
                    "-vcodec", "libx264",
                    "-pix_fmt", "yuv420p",
                    "-profile:v", "baseline",
                    "-level", "3",
                    "-preset", "medium",
                    "-crf", this.ComputeQuality("h264", targetFormat.quality).toString(),
                ];
                
            case "h264-high":
                if(videoStreams.Map(x => (x.codec_name === "h264") && (x.profile === "High")).All())
                    return ["-vcodec", "copy"];

                return [
                    "-vcodec", "libx264",
                    "-pix_fmt", "yuv420p",
                    "-profile:v", "high",
                    "-preset", "medium",
                    "-crf", this.ComputeQuality("h264", targetFormat.quality).toString(),
                ];

            case "h265":
                if(videoStreams.Map(x => x.codec_name === "hevc").All())
                    return ["-vcodec", "copy"];

                return [
                    "-vcodec", "libx265",
                    "-preset", "medium",
                    "-crf", this.ComputeQuality("h265", targetFormat.quality).toString(),
                ];
        }
    }

    private async ReadInputFiles(resourceReference: LightweightResourceReference, localPath: string)
    {
        const dataPath = this.fileStoragesManager.GetDataPath(resourceReference);
        const dirPath = path.join(dataPath, localPath);

        const children = await this.remoteFileSystemManager.ListDirectoryContents(resourceReference.hostId, dirPath);
        return children.map(x => path.join(dirPath, x));
    }

    private async TranscodeFile(hostId: number, filePath: string, targetFormat: AVTranscoderFormat, instanceDir: string, targetDirPath: string)
    {
        const mediaInfo = await this.codecService.AnalyzeMediaFile(hostId, filePath);

        const vcodecParams = this.GetVideoCodecParameters(targetFormat, mediaInfo.streams.Values().Filter(x => x.codec_type === "video"));
        const acodecParams = this.GetAudioCodecParameters(targetFormat, mediaInfo.streams.Values().Filter(x => x.codec_type === "audio"));
        const formatParams = this.GetContainerFormatParameters(targetFormat);

        const fileName = path.basename(filePath);
        const targetPath = path.join(instanceDir, "tmp", fileName.substring(0, fileName.length - path.extname(fileName).length) + "." + targetFormat.containerFormat);
        const command = [
            "ffmpeg",
            "-i", filePath,
            "-y", //overwrite file if exists (file is in tmp folder so no problem overwriting it. Files may remain in temp if there were problems moving it for example)
            ...vcodecParams,
            ...acodecParams,
            ...formatParams,
            targetPath
        ];
        await this.remoteCommandExecutor.ExecuteCommand(command, hostId);

        //move to target dir
        const exists = await this.remoteFileSystemManager.Exists(hostId, targetDirPath);
        if(!exists)
            await this.remoteRootFileSystemManager.CreateDirectory(hostId, targetDirPath);

        const finalPath = path.join(targetDirPath, path.basename(targetPath));
        await this.remoteRootFileSystemManager.MoveFile(hostId, targetPath, finalPath);
    }
}