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
export enum AVTranscoderQuality
{
    /**
     * Lossy compression accurate enough that the compressed result is perceptually indistinguishable from the uncompressed input, i.e. perceptually lossless. 
     */
    Transparent = 0,
    Standard = 1,
}

export interface AVTranscoderFormat
{
    /**
     * mp4 is supported by most devices for playback.
     * mkv is good for storing master files but not for distributing content as most devices don't support playback.
     */
    containerFormat: "mkv" | "mp4";
    /**
     * aac and mp3 are supported on most devices - few support for opus.
     * Quality wise: opus > mp3 > aac
     */
    audioCodec: "aac-lc" | "mp3" | "opus";
    /**
     * h264-high is recommended as it is supported by most modern devices. For legacy devices choose h264-baseline.
     * h265 is currently not recommended because of bad playback support.
     * Compression: h265 > h264-high > h264-baseline
     * Example: h264 high profile 5.1 is supported on iOS devices since iPhone 6s. h265 can for example not even be played on firefox desktop (as of 2024).
     */
    videoCodec: "h264-baseline" | "h264-high" | "h265";
    quality: AVTranscoderQuality;
}

export interface AVTranscoderConfig
{
    source: {
        /**
         * @title Source file storage
         * @format resource-same-host[file-services/file-storage]
         */
        sourceFileStorageExternalId: string;

        /**
         * @title Source path
         */
        sourcePath: string;
    };

    format: AVTranscoderFormat;
    targetPath: string;
}