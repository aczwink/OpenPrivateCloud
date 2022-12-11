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
    containerFormat: "mkv" | "mp4";
    audioCodec: "aac-lc" | "mp3" | "opus";
    videoCodec: "h264-baseline" | "h265";
    quality: AVTranscoderQuality;
}

export interface AVTranscoderConfig
{
    source: {
        /**
         * @title Source file storage
         */
        fullInstanceName: string;

        /**
         * @title Source path
         */
        sourcePath: string;
    };

    format: AVTranscoderFormat;
    targetPath: string;
}