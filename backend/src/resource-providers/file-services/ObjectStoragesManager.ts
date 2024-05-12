/**
 * OpenPrivateCloud
 * Copyright (C) 2023-2024 Amir Czwink (amir130@hotmail.de)
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
import { Injectable, Lock } from "acts-util-node";
import { LightweightResourceReference } from "../../common/ResourceReference";
import { ResourcesManager } from "../../services/ResourcesManager";
import { RemoteFileSystemManager } from "../../services/RemoteFileSystemManager";
import { Dictionary, NumberDictionary } from "acts-util-core";
import { ResourceConfigController } from "../../data-access/ResourceConfigController";
import { ObjectStorageProperties } from "./properties";
import { KeyVaultManager } from "../security-services/KeyVaultManager";
import { ResourceDependenciesController } from "../../data-access/ResourceDependenciesController";
import { CreateSymmetricKey, OPCFormat_SymmetricDecrypt, OPCFormat_SymmetricDecryptStream, OPCFormat_SymmetricEncrypt, SymmetricKeyToBuffer, UnpackSymmetricKey } from "../../common/crypto/symmetric";
import { GenerateRandomUUID } from "../../common/crypto/randomness";
import { Readable } from "stream";
import { RemoteCommandExecutor } from "../../services/RemoteCommandExecutor";
import { ModulesManager } from "../../services/ModulesManager";
import { AVPreviewService } from "./AVPreviewService";
import { ResourceStateResult } from "../ResourceProvider";

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

export type ThumbType = "" | "t" | "p";

@Injectable
export class ObjectStoragesManager
{
    constructor(private resourcesManager: ResourcesManager, private remoteFileSystemManager: RemoteFileSystemManager, private resourceConfigController: ResourceConfigController,
        private keyVaultManager: KeyVaultManager, private resourceDependenciesController: ResourceDependenciesController, private remoteCommandExecutor: RemoteCommandExecutor,
        private modulesManager: ModulesManager, private avPreviewService: AVPreviewService)
    {
        this.cachedIndex = {};
        this.thumbCreationLock = new Lock;
    }

    //Public methods
    public async CheckResourceHealth(resourceReference: LightweightResourceReference)
    {
        const fp = await this.resourcesManager.IsResourceStoragePathOwnershipCorrect(resourceReference);
        if(!fp)
        {
            const rootPath = this.resourcesManager.BuildResourceStoragePath(resourceReference);
            await this.resourcesManager.CorrectResourceStoragePathOwnership(resourceReference, [{ path: rootPath, recursive: true }]);
        }
    }

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
        await this.modulesManager.EnsureModuleIsInstalled(resourceReference.hostId, "ffmpeg");
        
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
        await this.remoteFileSystemManager.CreateDirectory(resourceReference.hostId, this.GetThumbnailsPath(resourceReference));

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

    public async QueryResourceState(resourceReference: LightweightResourceReference): Promise<ResourceStateResult>
    {
        const fp = await this.resourcesManager.IsResourceStoragePathOwnershipCorrect(resourceReference);
        if(!fp)
        {
            return {
                state: "corrupt",
                context: "incorrect file ownership"
            };
        }
        return "running";
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

        return {
            size: metaData.currentRev.blobSize,
            stream: await this.ReadBlob(resourceReference, blobId)
        };
    }

    public async RequestFileMetaData(resourceReference: LightweightResourceReference, fileId: string)
    {
        const encryptedId = await this.HashFileId(resourceReference, fileId);
        return this.RequestFileMetaDataInternal(resourceReference, encryptedId);
    }

    public async RequestFileRevisionBlob(resourceReference: LightweightResourceReference, fileId: string, revisionNumber: number)
    {
        const metaData = await this.RequestFileMetaData(resourceReference, fileId);
        const rev = metaData.revisions[revisionNumber];
        const blobId = rev.blobId;

        return {
            size: rev.blobSize,
            stream: await this.ReadBlob(resourceReference, blobId)
        };
    }

    public async RequestSnapshots(resourceReference: LightweightResourceReference)
    {
        const children = await this.remoteFileSystemManager.ListDirectoryContents(resourceReference.hostId, this.GetSnapshotsPath(resourceReference));
        return children.Values().Map(x => {
            const name = path.parse(x).name;
            return new Date(name.ReplaceAll("_", ":"));
        });
    }

    public async RequestFileThumbnail(resourceReference: LightweightResourceReference, fileId: string, thumbType: ThumbType)
    {
        const metaData = await this.RequestFileMetaData(resourceReference, fileId);
        const isImage = metaData.currentRev.mediaType.startsWith("image/");
        if(!(isImage || metaData.currentRev.mediaType.startsWith("video/")))
            return undefined;

        const thumbPath = path.join(this.GetThumbnailsPath(resourceReference), metaData.currentRev.blobId + thumbType);
        let encryptedThumb;
        try
        {
            encryptedThumb = await this.remoteFileSystemManager.ReadFile(resourceReference.hostId, thumbPath);
        }
        catch(e: any)
        {
            this.CreateThumbnailJob(resourceReference, metaData.currentRev.blobId, metaData.currentRev.blobSize, isImage);
            return undefined;
        }
        const decryptedThumb = await this.DecryptBuffer(resourceReference, encryptedThumb);

        return decryptedThumb;
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
    private indexWriteTimer?: NodeJS.Timeout;
    private thumbCreationLock: Lock;

    //Private methods
    private async CreateThumbnailJob(resourceReference: LightweightResourceReference, blobId: string, blobSize: number, isImage: boolean)
    {
        function MapType(type: "preview" | "thumb" | "tiles"): ThumbType
        {
            switch(type)
            {
                case "preview":
                    return "p";
                case "thumb":
                    return "";
                case "tiles":
                    return "t";
            }
        }

        const locked = await this.thumbCreationLock.Lock();

        //avoid computing it multiple times
        const thumbPath = path.join(this.GetThumbnailsPath(resourceReference), blobId);
        const exists = await this.remoteFileSystemManager.Exists(resourceReference.hostId, thumbPath);
        if(exists)
            return;

        const mountPoint = await this.avPreviewService.CreateWorkspace(resourceReference.hostId, blobSize);
        try
        {
            const blobStream = await this.ReadBlob(resourceReference, blobId);
            const blobPath = path.join(mountPoint, blobId);
            await this.remoteFileSystemManager.StreamToFile(resourceReference.hostId, blobPath, blobStream);

            const previews = await this.avPreviewService.CreatePreviews(blobPath, isImage);
            for (const previewFile of previews)
            {
                const thumb = await this.remoteFileSystemManager.ReadFile(resourceReference.hostId, previewFile.path);
                await this.remoteFileSystemManager.WriteFile(resourceReference.hostId, thumbPath + MapType(previewFile.type), await this.EncryptBuffer(resourceReference, thumb));
            }
        }
        finally
        {
            await this.avPreviewService.ReleaseWorkspace();
            locked.Release();
        }
    }

    private async DecryptBuffer(resourceReference: LightweightResourceReference, encrypted: Buffer)
    {
        const dek = await this.DeriveDataEncryptionKey(resourceReference);
        return OPCFormat_SymmetricDecrypt(dek, encrypted);
    }

    private async DecryptStream(resourceReference: LightweightResourceReference, encryptedStream: Readable)
    {
        const dek = await this.DeriveDataEncryptionKey(resourceReference);
        return OPCFormat_SymmetricDecryptStream(dek, encryptedStream);
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

    private GetThumbnailsPath(resourceReference: LightweightResourceReference)
    {
        const root = this.resourcesManager.BuildResourceStoragePath(resourceReference);
        return path.join(root, "thumbs");
    }

    private async ReadBlob(resourceReference: LightweightResourceReference, blobId: string)
    {
        const blobPath = path.join(this.GetBlobsPath(resourceReference), blobId);
        const encryptedDataStream = await this.remoteFileSystemManager.StreamFile(resourceReference.hostId, blobPath);

        const decryptedStream = await this.DecryptStream(resourceReference, encryptedDataStream);
        return decryptedStream;
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

        if(this.indexWriteTimer === undefined)
            this.indexWriteTimer = setTimeout(this.WriteIndex.bind(this, resourceReference.id), 1000 * 60 * 3);
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
        this.indexWriteTimer = undefined;
        const resourceReference = await this.resourcesManager.CreateResourceReference(resourceId);
        if(resourceReference === undefined)
            throw new Error("TODO: implement me");

        const root = this.resourcesManager.BuildResourceStoragePath(resourceReference);
        const indexPath = path.join(root, "index");

        const buffer = Buffer.from(JSON.stringify(this.cachedIndex[resourceId]), "utf-8");

        await this.remoteFileSystemManager.WriteFile(resourceReference.hostId, indexPath, await this.EncryptBuffer(resourceReference, buffer));
    }
}