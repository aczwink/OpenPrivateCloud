/**
 * OpenPrivateCloud
 * Copyright (C) 2023 Amir Czwink (amir130@hotmail.de)
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
import crypto from "crypto";
import path from "path";
import { Injectable } from "acts-util-node";
import { LightweightResourceReference } from "../../common/ResourceReference";
import { ResourcesManager } from "../../services/ResourcesManager";
import { RemoteFileSystemManager } from "../../services/RemoteFileSystemManager";
import { Dictionary, NumberDictionary } from "acts-util-core";
import { TaskScheduler } from "../../services/TaskScheduler";

interface EncryptionSettings
{
    algorithm: "aes-256-gcm";
    iv: Buffer;
    authTagLength: number;
}

export interface FileMetaDataRevision
{
    id: string;
    blobId: string;
    blobSize: number;
    creationTimeStamp: number;
    mediaType: string;
    fileName: string;
    tags: string[];
}

interface ObjectStorageFileIndex
{
    lastAccessTime: number;
}

interface ObjectStorageIndex
{
    files: Dictionary<ObjectStorageFileIndex>;
    fileWriteUpdateId?: number;
}

interface Snapshot
{
    files: StoredFileMetaData[];
}

interface StoredFileMetaData
{
    currentRev: FileMetaDataRevision;
    revisions: FileMetaDataRevision[];
}

@Injectable
export class ObjectStoragesManager
{
    constructor(private resourcesManager: ResourcesManager, private remoteFileSystemManager: RemoteFileSystemManager, private taskScheduler: TaskScheduler)
    {
        this.cachedIndex = {};
    }

    //Public methods
    public async CreateSnapshot(resourceReference: LightweightResourceReference)
    {
        const children = await this.remoteFileSystemManager.ListDirectoryContents(resourceReference.hostId, this.GetFilesDataPath(resourceReference));

        const snapshot: Snapshot = {
            files: []
        };

        for (const child of children)
        {
            const parts = child.split(".");
            const encryptedFileId = parts[0];
            const md = await this.RequestFileMetaDataInternal(resourceReference, encryptedFileId);
            snapshot.files.push(md);
        }

        const snapshotName = new Date().toISOString();
        const snapshotPath = path.join(this.GetSnapshotsPath(resourceReference), snapshotName);

        const encryptionSettings = this.GenerateEncryptionSettings();
        await this.WriteEncryptionSettings(resourceReference.hostId, snapshotPath + ".enc", encryptionSettings);

        const dataToWrite = Buffer.from(JSON.stringify(snapshot), "utf-8");
        await this.remoteFileSystemManager.WriteFile(resourceReference.hostId, snapshotPath + ".data", this.EncryptBuffer(encryptionSettings, dataToWrite));
    }

    public async DeleteFile(resourceReference: LightweightResourceReference, fileId: string)
    {
        const encryptedId = this.EncryptFileId(fileId);

        const fileMetaDataPath = this.FormFileMetaDataPath(resourceReference, encryptedId);
        await this.remoteFileSystemManager.UnlinkFile(resourceReference.hostId, fileMetaDataPath);
        const fileMetaDataEncSettingsPath = this.FormFileMetaDataEncryptionSettingsPath(resourceReference, encryptedId);
        await this.remoteFileSystemManager.UnlinkFile(resourceReference.hostId, fileMetaDataEncSettingsPath);
    }

    public async DeleteResource(resourceReference: LightweightResourceReference)
    {
        await this.resourcesManager.RemoveResourceStorageDirectory(resourceReference);

        return null;
    }

    public async ProvideResource(resourceReference: LightweightResourceReference)
    {
        await this.resourcesManager.CreateResourceStorageDirectory(resourceReference);
        await this.remoteFileSystemManager.CreateDirectory(resourceReference.hostId, this.GetBlobsPath(resourceReference));
        await this.remoteFileSystemManager.CreateDirectory(resourceReference.hostId, this.GetFilesDataPath(resourceReference));
        await this.remoteFileSystemManager.CreateDirectory(resourceReference.hostId, this.GetFileEncryptionSettingsPath(resourceReference));
        await this.remoteFileSystemManager.CreateDirectory(resourceReference.hostId, this.GetSnapshotsPath(resourceReference));

        this.cachedIndex[resourceReference.id] = {
            files: {},
        };
        this.WriteIndex(resourceReference.id);
    }

    public async RequestFileAccessTime(resourceReference: LightweightResourceReference, fileId: string)
    {
        if(!(resourceReference.id in this.cachedIndex))
            this.cachedIndex[resourceReference.id]! = await this.ReadIndex(resourceReference);
        const index = this.cachedIndex[resourceReference.id]!;

        const file = index.files[fileId];
        if(file === undefined)
        {
            const md = await this.RequestFileMetaData(resourceReference, fileId);
            return md.currentRev.creationTimeStamp;
        }
        return file.lastAccessTime;
    }

    public async RequestFileBlob(resourceReference: LightweightResourceReference, fileId: string)
    {
        const metaData = await this.RequestFileMetaData(resourceReference, fileId);
        const blobId = metaData.currentRev.blobId;

        await this.UpdateFileAccessTime(resourceReference, fileId);

        const blobPath = path.join(this.GetBlobsPath(resourceReference), blobId + ".data");
        const encryptedData = await this.remoteFileSystemManager.ReadFile(resourceReference.hostId, blobPath);

        const encPath = path.join(this.GetBlobsPath(resourceReference), blobId + ".enc");
        const encryptionSettings = await this.ReadEncryptionSettings(resourceReference.hostId, encPath);
        const decryptedData = this.DecryptBuffer(encryptionSettings, encryptedData);

        return decryptedData;
    }

    public RequestFileMetaData(resourceReference: LightweightResourceReference, fileId: string)
    {
        const encryptedId = this.EncryptFileId(fileId);
        return this.RequestFileMetaDataInternal(resourceReference, encryptedId);
    }

    public async RequestSnapshots(resourceReference: LightweightResourceReference)
    {
        const children = await this.remoteFileSystemManager.ListDirectoryContents(resourceReference.hostId, this.GetSnapshotsPath(resourceReference));
        return children.Values().Filter(x => x.endsWith(".data")).Map(x => {
            const name = path.parse(x).name;
            return new Date(name);
        });
    }

    public async SaveFile(resourceReference: LightweightResourceReference, fileId: string, blob: Buffer, mediaType: string, originalName: string)
    {
        const blobId = await this.WriteBlob(resourceReference, blob);

        const newRevision: FileMetaDataRevision = {
            blobId,
                blobSize: blob.byteLength,
                creationTimeStamp: Date.now(),
                fileName: originalName,
                id: fileId,
                mediaType,
                tags: []
        };

        const encryptedId = this.EncryptFileId(fileId);
        const fileMetaDataPath = this.FormFileMetaDataPath(resourceReference, encryptedId);

        const exists = await this.remoteFileSystemManager.Exists(resourceReference.hostId, fileMetaDataPath);
        let fileMetaData: StoredFileMetaData;
        if(exists)
        {
            fileMetaData = await this.RequestFileMetaDataInternal(resourceReference, encryptedId);
            fileMetaData.revisions.push(fileMetaData.currentRev);
            fileMetaData.currentRev = newRevision;
        }
        else
        {
            fileMetaData = {
                currentRev: newRevision,
                revisions: [],
            };
        }

        const fileMetaDataEncSettingsPath = this.FormFileMetaDataEncryptionSettingsPath(resourceReference, encryptedId);
        const encryptionSettings = this.GenerateEncryptionSettings();
        await this.WriteEncryptionSettings(resourceReference.hostId, fileMetaDataEncSettingsPath, encryptionSettings);

        const fileMetaDataBuffer = Buffer.from(JSON.stringify(fileMetaData), "utf-8");
        await this.remoteFileSystemManager.WriteFile(resourceReference.hostId, fileMetaDataPath, this.EncryptBuffer(encryptionSettings, fileMetaDataBuffer));
    }

    public async SearchFiles(resourceReference: LightweightResourceReference)
    {
        const children = await this.remoteFileSystemManager.ListDirectoryContents(resourceReference.hostId, this.GetFilesDataPath(resourceReference));

        const result = [];
        for (const child of children)
        {
            const parts = child.split(".");
            const md = await this.RequestFileMetaDataInternal(resourceReference, parts[0]);
            result.push(md.currentRev);
        }
        return result;
    }

    //Private state
    private cachedIndex: NumberDictionary<ObjectStorageIndex>;

    //Private methods
    private DecryptBuffer(encryptionSettings: EncryptionSettings, encrypted: Buffer)
    {
        const decipher = crypto.createDecipheriv(encryptionSettings.algorithm, this.DeriveDataEncryptionKey(), encryptionSettings.iv, {
            authTagLength: encryptionSettings.authTagLength,
        });

        const authTag = encrypted.subarray(0, encryptionSettings.authTagLength);
        decipher.setAuthTag(authTag);

        const payload = encrypted.subarray(encryptionSettings.authTagLength);
        const decryptedBlock = decipher.update(payload);
        const finalBlock = decipher.final();

        return Buffer.concat([decryptedBlock, finalBlock]);
    }

    private DeriveDataEncryptionKey()
    {
        //TODO: implement THIS
        return Buffer.from("01234567890123456789012345678901");
    }

    private DeriveFileIdEncryptionSettings(): EncryptionSettings
    {
        //TODO: the iv should be generated (and remembered) once per instance
        return {
            algorithm: "aes-256-gcm",
            authTagLength: 4,
            iv: Buffer.from("0123456789012345")
        };
    }

    private EncryptBuffer(encryptionSettings: EncryptionSettings, payload: Buffer)
    {
        const cipher = crypto.createCipheriv(encryptionSettings.algorithm, this.DeriveDataEncryptionKey(), encryptionSettings.iv, {
            authTagLength: encryptionSettings.authTagLength,
        });

        const encryptedBlocks = cipher.update(payload);
        const lastBlock = cipher.final();
        const encrypted = Buffer.concat([cipher.getAuthTag(), encryptedBlocks, lastBlock]);

        return encrypted;
    }

    private EncryptFileId(fileId: string)
    {
        const encryptionSettings = this.DeriveFileIdEncryptionSettings();
        const payload = this.EncryptBuffer(encryptionSettings, Buffer.from(fileId, "utf-8"));

        return crypto.createHash("sha256").update(payload).digest().toString("hex");
    }

    private FormFileMetaDataPath(resourceReference: LightweightResourceReference, encryptedId: string)
    {
        return path.join(this.GetFilesDataPath(resourceReference), encryptedId);
    }

    private FormFileMetaDataEncryptionSettingsPath(resourceReference: LightweightResourceReference, encryptedId: string)
    {
        return path.join(this.GetFileEncryptionSettingsPath(resourceReference), encryptedId);
    }

    private GenerateEncryptionSettings(): EncryptionSettings
    {
        return {
            algorithm: "aes-256-gcm",
            authTagLength: 16,
            iv: crypto.randomBytes(16)
        };
    }

    private GetBlobsPath(resourceReference: LightweightResourceReference)
    {
        const root = this.resourcesManager.BuildResourceStoragePath(resourceReference);
        return path.join(root, "blobs");
    }

    private GetFilesDataPath(resourceReference: LightweightResourceReference)
    {
        const root = this.resourcesManager.BuildResourceStoragePath(resourceReference);
        return path.join(root, "files");
    }

    private GetFileEncryptionSettingsPath(resourceReference: LightweightResourceReference)
    {
        const root = this.resourcesManager.BuildResourceStoragePath(resourceReference);
        return path.join(root, "fileEnc");
    }

    private GetSnapshotsPath(resourceReference: LightweightResourceReference)
    {
        const root = this.resourcesManager.BuildResourceStoragePath(resourceReference);
        return path.join(root, "snapshots");
    }

    private async RequestFileMetaDataInternal(resourceReference: LightweightResourceReference, encryptedId: string)
    {
        const fileMetaDataPath = this.FormFileMetaDataPath(resourceReference, encryptedId);
        const encryptedMetaData = await this.remoteFileSystemManager.ReadFile(resourceReference.hostId, fileMetaDataPath);

        const encPath = path.join(this.GetFileEncryptionSettingsPath(resourceReference), encryptedId);
        const encryptionSettings = await this.ReadEncryptionSettings(resourceReference.hostId, encPath);
        const decryptedMetaData = this.DecryptBuffer(encryptionSettings, encryptedMetaData);

        const fileMetaData: StoredFileMetaData = JSON.parse(decryptedMetaData.toString("utf-8"));
        return fileMetaData;
    }

    private async ReadEncryptionSettings(hostId: number, encPath: string): Promise<EncryptionSettings>
    {
        const stringData = await this.remoteFileSystemManager.ReadTextFile(hostId, encPath);
        const json = JSON.parse(stringData);

        return {
            algorithm: json.algorithm,
            authTagLength: json.authTagLength,
            iv: Buffer.from(json.iv, "base64")
        };
    }

    private async ReadIndex(resourceReference: LightweightResourceReference)
    {
        const root = this.resourcesManager.BuildResourceStoragePath(resourceReference);
        const indexPath = path.join(root, "index.json");
        const indexEncPath = path.join(root, "index.json.enc");

        const encrypted = await this.remoteFileSystemManager.ReadFile(resourceReference.hostId, indexPath);
        const encryptionSettings = await this.ReadEncryptionSettings(resourceReference.hostId, indexEncPath);
        const decrypted = this.DecryptBuffer(encryptionSettings, encrypted);

        return JSON.parse(decrypted.toString("utf-8")) as ObjectStorageIndex;
    }

    private async UpdateFileAccessTime(resourceReference: LightweightResourceReference, fileId: string)
    {
        if(!(resourceReference.id in this.cachedIndex))
            this.cachedIndex[resourceReference.id]! = await this.ReadIndex(resourceReference);
        const index = this.cachedIndex[resourceReference.id]!;

        const files = index.files;
        if(fileId in files)
            files[fileId]!.lastAccessTime = Date.now();
        else
            files[fileId] = { lastAccessTime: Date.now() };

        if(index.fileWriteUpdateId === undefined)
            index.fileWriteUpdateId = this.taskScheduler.ScheduleAfterHours(3, this.WriteIndex.bind(this, resourceReference.id));
    }

    private async WriteBlob(resourceReference: LightweightResourceReference, blob: Buffer): Promise<string>
    {
        const blobId = crypto.randomUUID();
        const blobPath = path.join(this.GetBlobsPath(resourceReference), blobId + ".data");

        const exists = await this.remoteFileSystemManager.Exists(resourceReference.hostId, blobPath);
        if(exists)
            return await this.WriteBlob(resourceReference, blob); //simply try again with different id

        const encryptionSettings = this.GenerateEncryptionSettings();
        await this.remoteFileSystemManager.WriteFile(resourceReference.hostId, blobPath, this.EncryptBuffer(encryptionSettings, blob));
        const encPath = path.join(this.GetBlobsPath(resourceReference), blobId + ".enc");
        await this.WriteEncryptionSettings(resourceReference.hostId, encPath, encryptionSettings);

        return blobId;
    }

    private async WriteIndex(resourceId: number)
    {
        this.cachedIndex[resourceId]!.fileWriteUpdateId = undefined;
        const resourceReference = await this.resourcesManager.CreateResourceReference(resourceId);
        if(resourceReference === undefined)
            throw new Error("TODO: implement me");

        const root = this.resourcesManager.BuildResourceStoragePath(resourceReference);
        const indexPath = path.join(root, "index.json");
        const indexEncPath = path.join(root, "index.json.enc");

        const buffer = Buffer.from(JSON.stringify(this.cachedIndex[resourceId]), "utf-8");

        const encryptionSettings = this.GenerateEncryptionSettings();
        await this.remoteFileSystemManager.WriteFile(resourceReference.hostId, indexPath, this.EncryptBuffer(encryptionSettings, buffer));
        await this.WriteEncryptionSettings(resourceReference.hostId, indexEncPath, encryptionSettings);
    }

    private async WriteEncryptionSettings(hostId: number, encPath: string, encryptionSettings: EncryptionSettings)
    {
        const json = {
            algorithm: encryptionSettings.algorithm,
            authTagLength: encryptionSettings.authTagLength,
            iv: encryptionSettings.iv.toString("base64")
        };
        await this.remoteFileSystemManager.WriteTextFile(hostId, encPath, JSON.stringify(json));
    }
}