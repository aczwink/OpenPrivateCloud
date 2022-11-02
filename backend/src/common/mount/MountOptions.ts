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

export interface MountedFileSytem
{
    source: string;
    target: string;
    fsType: string;
    options: string[];
}


export enum MountableBy
{
    /**
     * Only root can mount/unmount the filesystem.
     */
    Root,
    /**
     * Any user can mount the filesystem but only he can unmount it.
     */
    AnyUserBecomesOwner,
    /**
     * Any user can mount the filesystem and any other user can unmount it.
     */
    AnyUser
}

export interface FileSystemIndependentMountOptions
{
    /**
     * Whether the filesystem should be automatically mounted on bootup.
     * @default true
     */
    autoMount: boolean;

    /**
     * @default Root
     */
    mountableBy: MountableBy;

    /**
     * Whether the filesystem is writable or read-only.
     * @default true
     */
    writable: boolean;
}

interface CIFSTypeAndOptions extends FileSystemIndependentMountOptions
{
    type: "cifs";
    userName: string;
    password: string;
    domain: string;
}

interface UnknownTypeAndOptions extends FileSystemIndependentMountOptions
{
    type: "unknown";
    fsType: string;
    fileSystemSpecificOptions: string[];
}

export type FileSystemTypeAndOptions = CIFSTypeAndOptions | UnknownTypeAndOptions;

export interface StaticFileSystemProperties
{
    mountPoint: string;
    options: FileSystemTypeAndOptions;
    dump: number;
    pass: number;
}

export interface StaticFileSystem
{
    name: string;
    properties: StaticFileSystemProperties;
}