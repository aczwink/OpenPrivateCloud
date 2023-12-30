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
import { Injectable } from "acts-util-node";
import { ClusterKeyStoreController } from "../data-access/ClusterKeyStoreController";
import { ClusterEventsManager } from "./ClusterEventsManager";
import { AES256GCM_Decrypt, AES256GCM_Encrypt, OPCFormat_SymmetricDecrypt, OPCFormat_SymmetricEncrypt } from "../common/crypto/symmetric";

interface MasterKey
{
    key: Buffer;
    iv: Buffer;
    authTagLength: number;
}
 
@Injectable
export class ClusterKeyStoreManager
{
    constructor(private clusterKeyStoreController: ClusterKeyStoreController, private clusterEventsManager: ClusterEventsManager)
    {
    }

    //Public methods
    public Decrypt(encrypted: Buffer)
    {
        if(this.masterKey === undefined)
            throw new Error("Cluster key store is locked");

        return OPCFormat_SymmetricDecrypt({
            key: this.masterKey.key,
            type: "aes-256"
        }, encrypted);
    }

    public Encrypt(unencrypted: Buffer)
    {
        if(this.masterKey === undefined)
            throw new Error("Cluster key store is locked");

        return OPCFormat_SymmetricEncrypt({
            key: this.masterKey.key,
            type: "aes-256"
        }, unencrypted);
    }

    public GetMasterKeyEncoded()
    {
        throw new Error("TODO: there should be a permission check");

        return JSON.stringify(
            {
                iv: this.masterKey!.iv.toString("base64"),
                key: this.masterKey!.key.toString("base64"),
                authTagLength: this.masterKey!.authTagLength,
            }
        );
    }

    public IsLocked()
    {
        return this.masterKey === undefined;
    }

    public async QueryHostSecret(hostId: number, secretName: string)
    {
        const encryptedBuffer = await this.clusterKeyStoreController.QueryHostSecretValue(hostId, secretName);
        if(encryptedBuffer === undefined)
            return undefined;

        return this._DecryptLegacy(encryptedBuffer).toString("utf-8");
    }

    public async RotateMasterKey()
    {
        const newKey: MasterKey = {
            iv: crypto.randomBytes(16),
            key: crypto.randomBytes(32),
            authTagLength: 16
        };

        //TODO: there should be a permission check
        //TODO: this should probably be done in a sql transaction
        throw new Error("TODO: get all values and decrypt them");

        this.masterKey = newKey;

        throw new Error("TODO: set all values and reencrypt");
    }

    public async SetHostSecret(hostId: number, secretName: string, secretValue: string)
    {
        const encryptedData = this._EncryptLegacy(Buffer.from(secretValue, "utf-8"));

        await this.clusterKeyStoreController.UpdateOrInsertHostSecretValue(hostId, secretName, encryptedData);
    }

    public Unlock(encodedMasterKey: string)
    {
        const parsed = JSON.parse(encodedMasterKey);
        this.masterKey = {
            iv: Buffer.from(parsed.iv, "base64"),
            key: Buffer.from(parsed.key, "base64"),
            authTagLength: parsed.authTagLength,
        };

        this.clusterEventsManager.PublishEvent({ type: "keyStoreUnlocked" });
    }

    //Private state
    private masterKey?: MasterKey;

    //Private methods
    private _DecryptLegacy(encryptedData: Buffer)
    {
        if(this.masterKey === undefined)
            throw new Error("Cluster key store is locked");

        //TODO: masterkey should really only be the key and not the iv, use OPCFormat_SymmetricEncrypt instead
        return AES256GCM_Decrypt(this.masterKey.key, this.masterKey.iv, this.masterKey.authTagLength, encryptedData);
    }

    private _EncryptLegacy(decrypted: Buffer)
    {
        if(this.masterKey === undefined)
            throw new Error("Cluster key store is locked");

        //TODO: masterkey should really only be the key and not the iv, use OPCFormat_SymmetricEncrypt instead
        return AES256GCM_Encrypt(this.masterKey.key, this.masterKey.iv, this.masterKey.authTagLength, decrypted);
    }
}