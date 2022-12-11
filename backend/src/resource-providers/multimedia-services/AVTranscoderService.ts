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
import path from "path";
import { Injectable } from "acts-util-node";
import { AVTranscoderConfig, AVTranscoderFormat, AVTranscoderQuality } from "./AVTranscoderConfig";
import { RemoteFileSystemManager } from "../../services/RemoteFileSystemManager";
import { InstancesController } from "../../data-access/InstancesController";
import { HostStorage, HostStoragesController } from "../../data-access/HostStoragesController";
import { FileStoragesManager } from "../file-services/FileStoragesManager";
import { CodecService, FFProbe_StreamInfo } from "./CodecService";
import { RemoteCommandExecutor } from "../../services/RemoteCommandExecutor";
import { InstancesManager } from "../../services/InstancesManager";
import { RemoteRootFileSystemManager } from "../../services/RemoteRootFileSystemManager";
import { EnumeratorBuilder } from "acts-util-core/dist/Enumeration/EnumeratorBuilder";

@Injectable
export class AVTranscoderService
{
    constructor(private instancesController: InstancesController, private hostStoragesController: HostStoragesController,
        private remoteFileSystemManager: RemoteFileSystemManager, private fileStoragesManager: FileStoragesManager, private codecService: CodecService,
        private remoteCommandExecutor: RemoteCommandExecutor, private instancesManager: InstancesManager,
        private remoteRootFileSystemManager: RemoteRootFileSystemManager)
    {
    }

    //Public methods
    public async Transcode(instanceId: number, config: AVTranscoderConfig)
    {
        const sourceFileStorageInstance = await this.instancesController.QueryInstance(config.source.fullInstanceName);
        const sourceFileStorageInstanceStorage = await this.hostStoragesController.RequestHostStorage(sourceFileStorageInstance!.storageId);
        const hostId = sourceFileStorageInstanceStorage!.hostId;

        const instance = await this.instancesController.QueryInstanceById(instanceId);
        const storage = await this.hostStoragesController.RequestHostStorage(instance!.storageId);

        const instanceDir = this.instancesManager.BuildInstanceStoragePath(storage!.path, instance!.fullName);

        const files = await this.ReadInputFiles(config.source.fullInstanceName, config.source.sourcePath, sourceFileStorageInstanceStorage!);

        const dataPath = this.fileStoragesManager.GetDataPath(sourceFileStorageInstanceStorage!.path, config.source.fullInstanceName);
        const targetPath = path.join(dataPath, config.targetPath);
        for (const file of files)
            await this.TranscodeFile(hostId, file, config.format, instanceDir, targetPath);
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

    private async ReadInputFiles(fullInstanceName: string, localPath: string, storage: HostStorage)
    {
        const dataPath = this.fileStoragesManager.GetDataPath(storage.path, fullInstanceName);
        const dirPath = path.join(dataPath, localPath);

        const children = await this.remoteFileSystemManager.ListDirectoryContents(storage.hostId, dirPath);
        return children.map(x => path.join(dirPath, x.filename));
    }

    private async TranscodeFile(hostId: number, filePath: string, targetFormat: AVTranscoderFormat, instanceDir: string, targetDirPath: string)
    {
        const mediaInfo = await this.codecService.AnalyzeMediaFile(hostId, filePath);

        const vcodecParams = this.GetVideoCodecParameters(targetFormat, mediaInfo.streams.Values().Filter(x => x.codec_type === "video"));
        const acodecParams = this.GetAudioCodecParameters(targetFormat, mediaInfo.streams.Values().Filter(x => x.codec_type === "audio"));

        const fileName = path.basename(filePath);
        const targetPath = path.join(instanceDir, "tmp", fileName.substring(0, fileName.length - path.extname(fileName).length) + "." + targetFormat.containerFormat);
        await this.remoteCommandExecutor.ExecuteCommand(["ffmpeg", "-i", filePath, ...vcodecParams, ...acodecParams, targetPath], hostId);

        //move to target dir
        const finalPath = path.join(targetDirPath, path.basename(targetPath));
        await this.remoteRootFileSystemManager.MoveFile(hostId, targetPath, finalPath);
    }
}