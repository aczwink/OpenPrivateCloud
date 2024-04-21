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
import { Readable, Transform } from "stream";

type SymmetricCipherType = "aes-256";
interface SymmetricKey
{
    type: SymmetricCipherType;
    key: Buffer;
}

function AES256GCM_Encrypt(key: Buffer, iv: Buffer, authTagLength: number, data: Buffer)
{
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv, {
        authTagLength,
    });

    const encryptedBlocks = cipher.update(data);
    const lastBlock = cipher.final();
    const payload = Buffer.concat([cipher.getAuthTag(), encryptedBlocks, lastBlock]);
    return payload;
}

function OPCFormat_ReadHeaderAndCreateDecipher(key: Buffer, opcFormatData: Buffer)
{
    const signature = opcFormatData.toString("utf-8", 0, 3);
    if(signature !== "OPC")
        throw new Error("encoding error. invalid signature");
    const encFormatType = opcFormatData.readUInt8(3);

    switch(encFormatType)
    {
        case 0:
        {
            const iv = opcFormatData.subarray(4, 4+16);
            const authTag = opcFormatData.subarray(20, 20+16);

            const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv, {
                authTagLength: authTag.length,
            });
            decipher.setAuthTag(authTag);
        
            return {
                decipher,
                headerLength: 4 + 16 + 16
            };
        }
        break;
        default:
            throw new Error("encoding error. invalid format");
    }
}

export function CreateSymmetricKey(cipherType: SymmetricCipherType): SymmetricKey
{
    return {
        type: cipherType,
        key: crypto.randomBytes(32)
    };
}

export function OPCFormat_SymmetricDecrypt(key: SymmetricKey, opcFormatData: Buffer)
{
    const result = OPCFormat_ReadHeaderAndCreateDecipher(key.key, opcFormatData);
    const data = opcFormatData.subarray(result.headerLength);
    const decipher = result.decipher;

    const decrypted = decipher.update(data);
    return Buffer.concat([decrypted, decipher.final()]);
}

export function OPCFormat_SymmetricDecryptStream(key: SymmetricKey, opcFormattedStream: Readable): Readable
{
    const headerLength = 4 + 16 + 16;
    let decipher: crypto.DecipherGCM | null = null;
    let buffered = Buffer.alloc(0);
    const transform = new Transform({
        flush(callback)
        {
            const buffer = decipher!.final();
            callback(null, buffer);
        },

        transform(chunk, encoding, callback)
        {
            if(decipher === null)
            {
                buffered = Buffer.concat([buffered, chunk]);
                if(buffered.length >= headerLength)
                {
                    const result = OPCFormat_ReadHeaderAndCreateDecipher(key.key, buffered);
                    decipher = result.decipher;
                    const buffer = decipher.update(buffered.subarray(result.headerLength));
                    callback(null, buffer);
                }
            }
            else
            {
                const buffer = decipher.update(chunk);
                callback(null, buffer);
            }
        },
    });

    return opcFormattedStream.pipe(transform);
}

export function OPCFormat_SymmetricEncrypt(key: SymmetricKey, payload: Buffer)
{
    const header = Buffer.concat([Buffer.from("OPC"), Buffer.from([0])]);
    const iv = crypto.randomBytes(16);
    const encrypted = AES256GCM_Encrypt(key.key, iv, 16, payload);
    return Buffer.concat([header, iv, encrypted]);
}

export function SymmetricKeyToBuffer(key: SymmetricKey)
{
    const json = JSON.stringify({
        type: key.type,
        key: key.key.toString("base64")
    });
    return Buffer.from(json, "utf-8");
}

export function UnpackSymmetricKey(keyBuffer: Buffer): SymmetricKey
{
    const json = keyBuffer.toString("utf-8");
    const parsed = JSON.parse(json);

    return {
        key: Buffer.from(parsed.key, "base64"),
        type: parsed.type
    };
}