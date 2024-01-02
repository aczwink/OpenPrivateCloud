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
import { ResourceConfigController } from "../../data-access/ResourceConfigController";
import { ObjectStorageProperties } from "./properties";
import { KeyVaultManager } from "../security-services/KeyVaultManager";
import { ResourceDependenciesController } from "../../data-access/ResourceDependenciesController";
import { CreateSymmetricKey, OPCFormat_SymmetricDecrypt, OPCFormat_SymmetricEncrypt, SymmetricKeyToBuffer, UnpackSymmetricKey } from "../../common/crypto/symmetric";
import { GenerateRandomUUID } from "../../common/crypto/randomness";

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

interface ObjectStorageConfig
{
    keyVaultId: number;
    keyName: string;
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
    constructor(private resourcesManager: ResourcesManager, private remoteFileSystemManager: RemoteFileSystemManager, private taskScheduler: TaskScheduler, private resourceConfigController: ResourceConfigController,
        private keyVaultManager: KeyVaultManager, private resourceDependenciesController: ResourceDependenciesController)
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

        const snapshotName = new Date().toISOString().ReplaceAll(":", "_");
        const snapshotPath = path.join(this.GetSnapshotsPath(resourceReference), snapshotName);

        const dataToWrite = Buffer.from(JSON.stringify(snapshot), "utf-8");
        await this.remoteFileSystemManager.WriteFile(resourceReference.hostId, snapshotPath, await this.EncryptBuffer(resourceReference, dataToWrite));
    }

    public async DeleteFile(resourceReference: LightweightResourceReference, fileId: string)
    {
        const encryptedId = await this.HashFileId(resourceReference, fileId);

        const fileMetaDataPath = this.FormFileMetaDataPath(resourceReference, encryptedId);
        await this.remoteFileSystemManager.UnlinkFile(resourceReference.hostId, fileMetaDataPath);
    }

    public async DeleteResource(resourceReference: LightweightResourceReference)
    {
        await this.resourcesManager.RemoveResourceStorageDirectory(resourceReference);

        return null;
    }

    public async ProvideResource(properties: ObjectStorageProperties, resourceReference: LightweightResourceReference)
    {
        const kvRef = await this.keyVaultManager.ResolveKeyVaultReference(properties.rootKEK_KeyVaultReference);
        const config: ObjectStorageConfig = {
            keyName: kvRef.objectName,
            keyVaultId: kvRef.kvRef.id
        };
        await this.resourceConfigController.UpdateOrInsertConfig(resourceReference.id, config);
        await this.resourceDependenciesController.SetResourceDependencies(resourceReference.id, [kvRef.kvRef.id]);

        await this.resourcesManager.CreateResourceStorageDirectory(resourceReference);
        await this.remoteFileSystemManager.CreateDirectory(resourceReference.hostId, this.GetBlobsPath(resourceReference));
        await this.remoteFileSystemManager.CreateDirectory(resourceReference.hostId, this.GetFilesDataPath(resourceReference));
        await this.remoteFileSystemManager.CreateDirectory(resourceReference.hostId, this.GetSnapshotsPath(resourceReference));

        const key = CreateSymmetricKey("aes-256");
        const keyBuffer = SymmetricKeyToBuffer(key);
        const encryptedKey = await this.keyVaultManager.Encrypt(kvRef.kvRef, kvRef.objectName, keyBuffer);
        await this.remoteFileSystemManager.WriteFile(resourceReference.hostId, this.GetDataEncryptionKeyPath(resourceReference), encryptedKey);

        const encryptedSalt = await this.keyVaultManager.Encrypt(kvRef.kvRef, kvRef.objectName, crypto.randomBytes(16));
        await this.remoteFileSystemManager.WriteFile(resourceReference.hostId, this.GetFileIdSaltPath(resourceReference), encryptedSalt);

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

        return this.ReadBlob(resourceReference, blobId);
    }

    public async RequestFileMetaData(resourceReference: LightweightResourceReference, fileId: string)
    {
        const encryptedId = await this.HashFileId(resourceReference, fileId);
        return this.RequestFileMetaDataInternal(resourceReference, encryptedId);
    }

    public async RequestFileRevisionBlob(resourceReference: LightweightResourceReference, fileId: string, revisionNumber: number)
    {
        const metaData = await this.RequestFileMetaData(resourceReference, fileId);
        const blobId = metaData.revisions[revisionNumber].blobId;

        return this.ReadBlob(resourceReference, blobId);
    }

    public async RequestSnapshots(resourceReference: LightweightResourceReference)
    {
        const children = await this.remoteFileSystemManager.ListDirectoryContents(resourceReference.hostId, this.GetSnapshotsPath(resourceReference));
        return children.Values().Map(x => {
            const name = path.parse(x).name;
            return new Date(name.ReplaceAll("_", ":"));
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

        const encryptedId = await this.HashFileId(resourceReference, fileId);
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
        const fileMetaDataBuffer = Buffer.from(JSON.stringify(fileMetaData), "utf-8");
        await this.remoteFileSystemManager.WriteFile(resourceReference.hostId, fileMetaDataPath, await this.EncryptBuffer(resourceReference, fileMetaDataBuffer));
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
    private async DecryptBuffer(resourceReference: LightweightResourceReference, encrypted: Buffer)
    {
        const dek = await this.DeriveDataEncryptionKey(resourceReference);
        return OPCFormat_SymmetricDecrypt(dek, encrypted);
    }

    private async DeriveDataEncryptionKey(resourceReference: LightweightResourceReference)
    {
        const config = await this.RequestConfig(resourceReference.id);
        const kvRef = await this.resourcesManager.CreateResourceReference(config!.keyVaultId);

        const encryptedKey = await this.remoteFileSystemManager.ReadFile(resourceReference.hostId, this.GetDataEncryptionKeyPath(resourceReference));
        const keyBuffer = await this.keyVaultManager.Decrypt(kvRef!, config!.keyName, encryptedKey);
        const key = UnpackSymmetricKey(keyBuffer);

        return key;
    }

    private async EncryptBuffer(resourceReference: LightweightResourceReference, payload: Buffer)
    {
        const dek = await this.DeriveDataEncryptionKey(resourceReference);
        return OPCFormat_SymmetricEncrypt(dek, payload);
    }

    private async HashFileId(resourceReference: LightweightResourceReference, fileId: string)
    {
        const config = await this.RequestConfig(resourceReference.id);
        const kvRef = await this.resourcesManager.CreateResourceReference(config!.keyVaultId);

        const encryptedSalt = await this.remoteFileSystemManager.ReadFile(resourceReference.hostId, this.GetFileIdSaltPath(resourceReference));
        const decryptedSalt = await this.keyVaultManager.Decrypt(kvRef!, config!.keyName, encryptedSalt);
        
        return crypto.createHash("sha256").update(decryptedSalt).update(fileId).digest().toString("hex");
    }

    private FormFileMetaDataPath(resourceReference: LightweightResourceReference, encryptedId: string)
    {
        return path.join(this.GetFilesDataPath(resourceReference), encryptedId);
    }

    private GetBlobsPath(resourceReference: LightweightResourceReference)
    {
        const root = this.resourcesManager.BuildResourceStoragePath(resourceReference);
        return path.join(root, "blobs");
    }

    private GetDataEncryptionKeyPath(resourceReference: LightweightResourceReference)
    {
        const root = this.resourcesManager.BuildResourceStoragePath(resourceReference);
        return path.join(root, "dek");
    }

    private GetFileIdSaltPath(resourceReference: LightweightResourceReference)
    {
        const root = this.resourcesManager.BuildResourceStoragePath(resourceReference);
        return path.join(root, "salt");
    }

    private GetFilesDataPath(resourceReference: LightweightResourceReference)
    {
        const root = this.resourcesManager.BuildResourceStoragePath(resourceReference);
        return path.join(root, "files");
    }

    private GetSnapshotsPath(resourceReference: LightweightResourceReference)
    {
        const root = this.resourcesManager.BuildResourceStoragePath(resourceReference);
        return path.join(root, "snapshots");
    }

    private async ReadBlob(resourceReference: LightweightResourceReference, blobId: string)
    {
        const blobPath = path.join(this.GetBlobsPath(resourceReference), blobId);
        const encryptedData = await this.remoteFileSystemManager.ReadFile(resourceReference.hostId, blobPath);

        const decryptedData = await this.DecryptBuffer(resourceReference, encryptedData);

        return decryptedData;
    }

    private async ReadIndex(resourceReference: LightweightResourceReference)
    {
        const root = this.resourcesManager.BuildResourceStoragePath(resourceReference);
        const indexPath = path.join(root, "index");

        const encrypted = await this.remoteFileSystemManager.ReadFile(resourceReference.hostId, indexPath);
        const decrypted = await this.DecryptBuffer(resourceReference, encrypted);

        return JSON.parse(decrypted.toString("utf-8")) as ObjectStorageIndex;
    }

    private RequestConfig(resourceId: number)
    {
        return this.resourceConfigController.QueryConfig<ObjectStorageConfig>(resourceId);
    }

    private async RequestFileMetaDataInternal(resourceReference: LightweightResourceReference, encryptedId: string)
    {
        const fileMetaDataPath = this.FormFileMetaDataPath(resourceReference, encryptedId);
        const encryptedMetaData = await this.remoteFileSystemManager.ReadFile(resourceReference.hostId, fileMetaDataPath);

        const decryptedMetaData = await this.DecryptBuffer(resourceReference, encryptedMetaData);

        const fileMetaData: StoredFileMetaData = JSON.parse(decryptedMetaData.toString("utf-8"));
        return fileMetaData;
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
        const blobId = GenerateRandomUUID();
        const blobPath = path.join(this.GetBlobsPath(resourceReference), blobId);

        const exists = await this.remoteFileSystemManager.Exists(resourceReference.hostId, blobPath);
        if(exists)
            return await this.WriteBlob(resourceReference, blob); //simply try again with different id

        await this.remoteFileSystemManager.WriteFile(resourceReference.hostId, blobPath, await this.EncryptBuffer(resourceReference, blob));

        return blobId;
    }

    private async WriteIndex(resourceId: number)
    {
        this.cachedIndex[resourceId]!.fileWriteUpdateId = undefined;
        const resourceReference = await this.resourcesManager.CreateResourceReference(resourceId);
        if(resourceReference === undefined)
            throw new Error("TODO: implement me");

        const root = this.resourcesManager.BuildResourceStoragePath(resourceReference);
        const indexPath = path.join(root, "index");

        const buffer = Buffer.from(JSON.stringify(this.cachedIndex[resourceId]), "utf-8");

        await this.remoteFileSystemManager.WriteFile(resourceReference.hostId, indexPath, await this.EncryptBuffer(resourceReference, buffer));
    }
}