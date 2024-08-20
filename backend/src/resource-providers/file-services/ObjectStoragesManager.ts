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
import { ModulesManager } from "../../services/ModulesManager";
import { AVPreviewService } from "./AVPreviewService";
import { ResourceCheckResult, ResourceCheckType, ResourceState } from "../ResourceProvider";
import { HealthStatus } from "../../data-access/HealthController";
import { LargeFileDownloadService } from "../../services/LargeFileDownloadService";
import { CodecService, FFProbe_MediaInfo } from "../multimedia-services/CodecService";
import { StreamToBuffer } from "acts-util-node/dist/fs/Util";

export interface FileMetaDataRevision
{
    id: string;
    blobId: string;
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

interface ObjectStorageBlobHashes
{
    md5: string;
    sha256: string;
}

interface ObjectStorageBlobIndex
{
    size: number;

    hash: ObjectStorageBlobHashes;

    meta: {
        av?: FFProbe_MediaInfo;
    };
}

interface ObjectStorageCache
{
    tags: Set<string>;
}

interface ObjectStorageFileIndex
{
    currentRev: FileMetaDataRevision;
    accessCounter: number;
    lastAccessTime: number;
}

interface ObjectStorageIndex
{
    version: 0;
    blobs: Dictionary<ObjectStorageBlobIndex>;
    files: Dictionary<ObjectStorageFileIndex>;
}

interface Snapshot
{
    version: 0;
    blobs: Dictionary<ObjectStorageBlobIndex>;
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
        private keyVaultManager: KeyVaultManager, private resourceDependenciesController: ResourceDependenciesController, private largeFileDownloadService: LargeFileDownloadService,
        private modulesManager: ModulesManager, private avPreviewService: AVPreviewService, private codecService: CodecService)
    {
        this.index = {};
        this.cache = {};
        this.indexLock = new Lock;
        this.thumbCreationLock = new Lock;
    }

    //Public methods
    public async CheckResourceHealth(resourceReference: LightweightResourceReference, type: ResourceCheckType): Promise<HealthStatus | ResourceCheckResult>
    {
        switch(type)
        {
            case ResourceCheckType.Availability:
            {
                const fp = await this.resourcesManager.IsResourceStoragePathOwnershipCorrect(resourceReference);
                if(!fp)
                {
                    return {
                        status: HealthStatus.Corrupt,
                        context: "incorrect file ownership"
                    };
                }
            }
            break;
            case ResourceCheckType.ServiceHealth:
            {
                const fp = await this.resourcesManager.IsResourceStoragePathOwnershipCorrect(resourceReference);
                if(!fp)
                {
                    const rootPath = this.resourcesManager.BuildResourceStoragePath(resourceReference);
                    await this.resourcesManager.CorrectResourceStoragePathOwnership(resourceReference, [{ path: rootPath, recursive: true }]);
                }
            }
            break;
        }

        return HealthStatus.Up;
    }

    public async CreateFileBlobStreamRequest(resourceReference: LightweightResourceReference, userId: number, fileId: string)
    {
        const metaData = await this.RequestFileMetaData(resourceReference, fileId);
        const blobId = metaData.currentRev.blobId;
        const blobPath = path.join(this.GetBlobsPath(resourceReference), blobId);
        const blobMeta = await this.RequestBlobMetadata(resourceReference, blobId);

        await this.UpdateFileAccessTime(resourceReference, fileId);

        const dek = await this.DeriveDataEncryptionKey(resourceReference);
        return await this.largeFileDownloadService.CreateRequest({
            createStreamCallBack: this.ReadBlob.bind(this, resourceReference, blobId),
            readBlockCallBack: (start, end) => this.remoteFileSystemManager.ReadFileBlock(resourceReference.hostId, blobPath, start, end),
            mediaType: metaData.currentRev.mediaType,
            totalSize: blobMeta.size,
            userId,
            key: dek
        });
    }

    public async CreateSnapshot(resourceReference: LightweightResourceReference)
    {
        const children = await this.remoteFileSystemManager.ListDirectoryContents(resourceReference.hostId, this.GetFilesDataPath(resourceReference));

        const snapshot: Snapshot = {
            version: 0,
            blobs: (await this.GetIndex(resourceReference)).blobs,
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

        const index = await this.GetIndex(resourceReference);
        delete index.files[fileId];
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

        this.index[resourceReference.id] = {
            version: 0,
            blobs: {},
            files: {},
        };
        this.WriteIndex(resourceReference.id);
    }

    public async QueryResourceState(resourceReference: LightweightResourceReference): Promise<ResourceState>
    {
        return ResourceState.Running;
    }

    public async QueryStatistics(resourceReference: LightweightResourceReference)
    {
        const index = await this.GetIndex(resourceReference);
        return {
            totalFileCount: index.files.OwnKeys().Count(),
            totalBlobSize: index.blobs.Values().NotUndefined().Map(x => x.size).Sum()
        };
    }

    public async QueryTags(resourceReference: LightweightResourceReference)
    {
        const cache = await this.GetCache(resourceReference);
        return cache.tags;
    }

    public async RequestBlobMetadata(resourceReference: LightweightResourceReference, blobId: string)
    {
        const index = await this.GetIndex(resourceReference);
        return index.blobs[blobId]!;
    }

    public async RequestFileAccessStatistics(resourceReference: LightweightResourceReference, fileId: string)
    {
        const fileMeta = await this.GetFileMetaData(resourceReference, fileId);
        return {
            lastAccessTime: fileMeta.lastAccessTime,
            accessCounter: fileMeta.accessCounter
        };
    }

    public async RequestFileBlob(resourceReference: LightweightResourceReference, fileId: string)
    {
        const metaData = await this.RequestFileMetaData(resourceReference, fileId);
        const blobId = metaData.currentRev.blobId;
        const blobMeta = await this.RequestBlobMetadata(resourceReference, blobId);

        await this.UpdateFileAccessTime(resourceReference, fileId);

        return {
            size: blobMeta.size,
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
        const blobMeta = await this.RequestBlobMetadata(resourceReference, blobId);

        return {
            size: blobMeta.size,
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
            const blobMeta = await this.RequestBlobMetadata(resourceReference, metaData.currentRev.blobId);
            this.CreateThumbnailJob(resourceReference, metaData.currentRev.blobId, blobMeta.size, metaData.currentRev.mediaType);
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
        await this.WriteFileMetaData(resourceReference, fileMetaData);

        const index = await this.GetIndex(resourceReference);
        const fileMeta = index.files[fileId];
        if(fileMeta === undefined)
        {
            index.files[fileId] = {
                accessCounter: 0,
                currentRev: newRevision,
                lastAccessTime: newRevision.creationTimeStamp
            };
        }
        else
            fileMeta.currentRev = newRevision;
        await this.WriteIndex(resourceReference.id);
    }

    public async SearchFiles(resourceReference: LightweightResourceReference, searchCriteria: { name: string, mediaType: string, tags: string[]})
    {
        const nameFilter = searchCriteria.name.toLowerCase();
        const tagsSet = new Set(searchCriteria.tags);

        const index = await this.GetIndex(resourceReference);
        return index.files.Values().NotUndefined().Map(x => x.currentRev).Filter(x => {
            const nameMatch = x.id.toLowerCase().includes(nameFilter) || x.fileName.toLowerCase().includes(nameFilter);
            const mediaTypeMatch = x.mediaType.includes(searchCriteria.mediaType);
            const tagsMatch = new Set(x.tags).IsSuperSetOf(tagsSet);

            return nameMatch && mediaTypeMatch && tagsMatch;
        }).ToArray();
    }

    public async UpdateFileMetaData(resourceReference: LightweightResourceReference, fileId: string, tags: string[])
    {
        tags.SortBy(x => x);

        const encryptedId = await this.HashFileId(resourceReference, fileId);
        const md = await this.RequestFileMetaDataInternal(resourceReference, encryptedId);
        md.currentRev.tags = tags;

        const fd = await this.GetFileMetaData(resourceReference, fileId);
        fd.currentRev.tags = tags;

        await this.WriteFileMetaData(resourceReference, md);
        await this.WriteIndex(resourceReference.id);
    }

    //Private state
    private cache: NumberDictionary<ObjectStorageCache>;
    private index: NumberDictionary<ObjectStorageIndex>;
    private indexWriteTimer?: NodeJS.Timeout;
    private indexLock: Lock;
    private thumbCreationLock: Lock;

    //Private methods
    private async AnalyzeMissingMediaData(resourceReference: LightweightResourceReference, blobId: string, blobSize: number, mediaType: string)
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

        const mountPoint = await this.avPreviewService.CreateWorkspace(resourceReference.hostId, blobSize);
        try
        {
            const blobStream = await this.ReadBlob(resourceReference, blobId);
            const blobPath = path.join(mountPoint, blobId);
            await this.remoteFileSystemManager.StreamToFile(resourceReference.hostId, blobPath, blobStream);

            //check extra meta data
            const index = await this.GetIndex(resourceReference);
            let blobData = index.blobs[blobId]!;

            if(blobData.meta.av === undefined)
            {
                blobData.meta.av = await this.codecService.AnalyzeMediaFile(resourceReference.hostId, blobPath)
                this.ScheduleIndexWrite(resourceReference);
            }
            const mediaInfo = blobData.meta.av!;

            //thumbs
            const isImage = mediaType.startsWith("image/");
            const thumbTypes: ("preview" | "thumb" | "tiles")[] = isImage ? ["thumb"] : ["preview", "thumb", "tiles"];
            for (const thumbType of thumbTypes)
            {
                const thumbPath = path.join(this.GetThumbnailsPath(resourceReference), blobId + MapType(thumbType));
                const exists = await this.remoteFileSystemManager.Exists(resourceReference.hostId, thumbPath);
                if(exists)
                    continue;

                const previewFilePath = isImage
                    ? await this.avPreviewService.CreateImageThumb(blobPath, mediaInfo)
                    : await this.avPreviewService.CreateVideoPreview(blobPath, mediaInfo, thumbType);

                const thumb = await this.remoteFileSystemManager.ReadFile(resourceReference.hostId, previewFilePath);
                await this.remoteFileSystemManager.WriteFile(resourceReference.hostId, thumbPath, await this.EncryptBuffer(resourceReference, thumb));
            }
        }
        finally
        {
            await this.avPreviewService.ReleaseWorkspace();
        }
    }

    private ComputeBlobHashes(blob: Buffer): ObjectStorageBlobHashes
    {
        function hashit(algorithm: "md5" | "sha256")
        {
            return crypto.createHash(algorithm).update(blob).digest("hex");
        }

        return {
            md5: hashit("md5"),
            sha256: hashit("sha256"),
        };
    }

    private async CreateThumbnailJob(resourceReference: LightweightResourceReference, blobId: string, blobSize: number, mediaType: string)
    {
        const locked = await this.thumbCreationLock.Lock();

        //avoid computing it multiple times
        const thumbPath = path.join(this.GetThumbnailsPath(resourceReference), blobId);
        const exists = await this.remoteFileSystemManager.Exists(resourceReference.hostId, thumbPath);
        if(exists)
        {
            locked.Release();
            return;
        }

        try
        {
            await this.AnalyzeMissingMediaData(resourceReference, blobId, blobSize, mediaType);
        }
        finally
        {
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

    private async GetCache(resourceReference: LightweightResourceReference)
    {
        const cache = this.cache[resourceReference.id];
        if(cache === undefined)
        {
            const index = await this.GetIndex(resourceReference);
            const cache = this.cache[resourceReference.id] = {
                tags: index.files.Values().NotUndefined().Map(x => x.currentRev.tags.Values()).Flatten().ToSet()
            };

            return cache;
        }
        return cache;
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

    private async GetFileMetaData(resourceReference: LightweightResourceReference, fileId: string)
    {
        const index = await this.GetIndex(resourceReference);
        const fileMetaData = index.files[fileId]!;
        return fileMetaData;
    }

    private GetFilesDataPath(resourceReference: LightweightResourceReference)
    {
        const root = this.resourcesManager.BuildResourceStoragePath(resourceReference);
        return path.join(root, "files");
    }

    private async GetIndex(resourceReference: LightweightResourceReference)
    {
        const index = this.index[resourceReference.id];
        if(index === undefined)
        {
            const lock = await this.indexLock.Lock();

            const indexSecondTry = this.index[resourceReference.id];
            if(indexSecondTry !== undefined)
            {
                lock.Release();
                return indexSecondTry;
            }

            const index = this.index[resourceReference.id] = await this.ReadIndex(resourceReference);
            lock.Release();
            return index;
        }
        return index;
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

        const indexData = JSON.parse(decrypted.toString("utf-8")) as ObjectStorageIndex;
        await this.TransformIndexData(resourceReference, indexData);
        return indexData;
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

    private async TransformIndexData(resourceReference: LightweightResourceReference, indexData: ObjectStorageIndex)
    {
    }

    private ScheduleIndexWrite(resourceReference: LightweightResourceReference)
    {
        if(this.indexWriteTimer === undefined)
            this.indexWriteTimer = setTimeout(this.WriteIndex.bind(this, resourceReference.id), 1000 * 60 * 3);
    }

    private async UpdateFileAccessTime(resourceReference: LightweightResourceReference, fileId: string)
    {
        const index = await this.GetIndex(resourceReference);
        const fileMetaData = index.files[fileId]!;

        fileMetaData.lastAccessTime = Date.now();
        fileMetaData.accessCounter++;

        this.ScheduleIndexWrite(resourceReference);
    }

    private async WriteBlob(resourceReference: LightweightResourceReference, blob: Buffer): Promise<string>
    {
        const blobId = GenerateRandomUUID();
        const blobPath = path.join(this.GetBlobsPath(resourceReference), blobId);

        const exists = await this.remoteFileSystemManager.Exists(resourceReference.hostId, blobPath);
        if(exists)
            return await this.WriteBlob(resourceReference, blob); //simply try again with different id

        await this.remoteFileSystemManager.WriteFile(resourceReference.hostId, blobPath, await this.EncryptBuffer(resourceReference, blob));

        const index = await this.GetIndex(resourceReference);
        index.blobs[blobId] = {
            hash: this.ComputeBlobHashes(blob),
            meta: {
            },
            size: blob.byteLength
        };
        //don't write index here. it is written at the end of file save

        return blobId;
    }

    private async WriteFileMetaData(resourceReference: LightweightResourceReference, fileMetaData: StoredFileMetaData)
    {
        const encryptedId = await this.HashFileId(resourceReference, fileMetaData.currentRev.id);
        const fileMetaDataPath = this.FormFileMetaDataPath(resourceReference, encryptedId);

        const fileMetaDataBuffer = Buffer.from(JSON.stringify(fileMetaData), "utf-8");
        await this.remoteFileSystemManager.WriteFile(resourceReference.hostId, fileMetaDataPath, await this.EncryptBuffer(resourceReference, fileMetaDataBuffer));
    }

    private async WriteIndex(resourceId: number)
    {
        this.indexWriteTimer = undefined;
        const resourceReference = await this.resourcesManager.CreateResourceReference(resourceId);
        if(resourceReference === undefined)
            throw new Error("TODO: implement me");

        const root = this.resourcesManager.BuildResourceStoragePath(resourceReference);
        const indexPath = path.join(root, "index");

        const buffer = Buffer.from(JSON.stringify(this.index[resourceId]), "utf-8");

        await this.remoteFileSystemManager.WriteFile(resourceReference.hostId, indexPath, await this.EncryptBuffer(resourceReference, buffer));
    }
}