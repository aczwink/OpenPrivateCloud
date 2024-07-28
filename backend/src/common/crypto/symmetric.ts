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

export interface OPCFormat_Header
{
    cipher: "aes-256-gcm";
    headerLength: number;
    authTag: Buffer;
    iv: Buffer;
}

type SymmetricCipherType = "aes-256";
export interface SymmetricKey
{
    type: SymmetricCipherType;
    key: Buffer;
}

export const OPCFormat_MaxHeaderLength = 4 + 16 + 16; //version 0 has 4 bytes header, 16 bytes iv and 16 bytes auth tag

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

export function OPCFormat_ReadHeader(opcFormatData: Buffer): OPCFormat_Header
{
    const signature = opcFormatData.toString("utf-8", 0, 3);
    if(signature !== "OPC")
        throw new Error("encoding error. invalid signature");
    const encFormatType = opcFormatData.readUInt8(3);

    const signatureLen = 4;
    const authTagLen = 16;
    switch(encFormatType)
    {
        case 0:
        {
            const ivLen = 16;
            const authTagOffset = signatureLen + ivLen;
            return {
                cipher: "aes-256-gcm",
                headerLength: signatureLen + ivLen + authTagLen,
                authTag: opcFormatData.subarray(authTagOffset, authTagOffset + authTagLen),
                iv: opcFormatData.subarray(signatureLen, authTagOffset)
            };
        }
        case 1:
        {
            const ivLen = 12;
            const authTagOffset = signatureLen + ivLen;
            return {
                cipher: "aes-256-gcm",
                headerLength: signatureLen + ivLen + authTagLen,
                authTag: opcFormatData.subarray(authTagOffset, authTagOffset + authTagLen),
                iv: opcFormatData.subarray(signatureLen, authTagOffset)
            };
        }
        default:
            throw new Error("encoding error. invalid format");
    }
}

function OPCFormat_ReadHeaderAndCreateDecipher(key: Buffer, opcFormatData: Buffer)
{
    const header = OPCFormat_ReadHeader(opcFormatData);

    const decipher = crypto.createDecipheriv("aes-256-gcm", key, header.iv, {
        authTagLength: header.authTag.length,
    });
    decipher.setAuthTag(header.authTag);

    return {
        decipher,
        headerLength: header.headerLength
    };
}

export function OPCFormat_SupportsRandomAccess(header: OPCFormat_Header)
{
    return header.headerLength !== OPCFormat_MaxHeaderLength;
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

export function OPCFormat_SymmetricDecryptSlice(key: SymmetricKey, header: OPCFormat_Header, firstBlockNumber: number, encryptedBlock: Buffer)
{
    function incrementIV(iv: Buffer, increment: number)
    {
        if(iv.length !== 16) throw new Error('Only implemented for 16 bytes IV');
    
        const MAX_UINT32 = 0xFFFFFFFF;
        let incrementBig = ~~(increment / MAX_UINT32);
        let incrementLittle = (increment % MAX_UINT32) - incrementBig;
    
        // split the 128bits IV in 4 numbers, 32bits each
        let overflow = 0;
        for(let idx = 0; idx < 4; ++idx) {
            let num = iv.readUInt32BE(12 - idx*4);
    
            let inc = overflow;
            if(idx == 0) inc += incrementLittle;
            if(idx == 1) inc += incrementBig;
    
            num += inc;
    
            let numBig = ~~(num / MAX_UINT32);
            let numLittle = (num % MAX_UINT32) - numBig;
            overflow = numBig;
    
            iv.writeUInt32BE(numLittle, 12 - idx*4);
        }
    }

    const iv = Buffer.alloc(16);
    header.iv.copy(iv, 0, 0, 12);
    incrementIV(iv, 2 + firstBlockNumber); //for gcm counter starts at 1, but the aad is calculated first, so start at 2

    const decipher = crypto.createDecipheriv("aes-256-ctr", key.key, iv);

    const decrypted = decipher.update(encryptedBlock);
    return Buffer.concat([decrypted, decipher.final()]);
}

export function OPCFormat_SymmetricDecryptStream(key: SymmetricKey, opcFormattedStream: Readable): Readable
{
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
                if(buffered.length >= OPCFormat_MaxHeaderLength)
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
    const versionNumber = 1;
    const header = Buffer.concat([Buffer.from("OPC"), Buffer.from([versionNumber])]);
    const iv = crypto.randomBytes(12);
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