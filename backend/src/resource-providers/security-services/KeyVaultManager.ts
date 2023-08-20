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
import { DeploymentContext, ResourceStateResult } from "../ResourceProvider";
import { KeyVaultProperties } from "./properties";
import { ResourcesManager } from "../../services/ResourcesManager";
import { RemoteFileSystemManager } from "../../services/RemoteFileSystemManager";
import { CA_Config, CertKeyPaths, EasyRSAManager } from "./EasyRSAManager";
import { ResourceConfigController } from "../../data-access/ResourceConfigController";
import { ResourceEventsManager } from "../../services/ResourceEventsManager";
import { securityServicesEvents } from "./events";
import { RemoteCommandExecutor } from "../../services/RemoteCommandExecutor";
import { Command } from "../../services/SSHService";

interface KeyVaultCertificate
{
    name: string;
    type: "client" | "server";
    generatedByCA: boolean;
}

interface KeyVaultCertificateInfo extends KeyVaultCertificate
{
    expiryDate: Date;
}

interface KeyVaultConfig
{
    caConfig: CA_Config;
    state: {
        certificates: KeyVaultCertificate[];
    };
}

@Injectable
export class KeyVaultManager
{
    constructor(private resourcesManager: ResourcesManager, private remoteFileSystemManager: RemoteFileSystemManager, private resourceConfigController: ResourceConfigController, private easyRSAManager: EasyRSAManager,
        private resourceEventsManager: ResourceEventsManager, private remoteCommandExecutor: RemoteCommandExecutor)
    {
    }

    //Public methods
    public async CreateEncryptionCommand(input: Command, encryptionKeyKeyVaultReference: string): Promise<Command>
    {
        const result = await this.ResolveKeyVaultReference(encryptionKeyKeyVaultReference);
        if(result.objectType !== "key")
            throw new Error("Invalid key reference: " + encryptionKeyKeyVaultReference);
        const keyPath = path.join(this.GetKeysDir(result.kvRef), result.objectName);
        
        return {
            type: "pipe",
            source: input,
            target: [
                "gpg",
                "-z", "0", //no compression
                "--passphrase-file", keyPath,
                "--cipher-algo", "AES256",
                "--symmetric",
                "--batch",
                "--no-symkey-cache", //don't cache password in keyring
                "-" //write to stdout
            ]
        };
    }

    public async CreateKey(resourceReference: LightweightResourceReference, name: string, keySize: number)
    {
        const value = crypto.randomBytes(keySize / 8);
        
        const keyPath = path.join(this.GetKeysDir(resourceReference), name);
        await this.remoteFileSystemManager.WriteFile(resourceReference.hostId, keyPath, value);
    }

    public async CreateKeyVaultReference(keyVaultResourceId: number, objectType: "certificate" | "key" | "secret", objectName: string): Promise<string>
    {
        const kvRef = await this.resourcesManager.CreateResourceReference(keyVaultResourceId);

        return kvRef!.externalId + "/" + objectType + "s/" + objectName;
    }

    public async CreateSecret(resourceReference: LightweightResourceReference, name: string, value: string)
    {
        const secretPath = path.join(this.GetSecretsDir(resourceReference), name);
        await this.remoteFileSystemManager.WriteTextFile(resourceReference.hostId, secretPath, value);
    }

    public async DeleteResource(resourceReference: LightweightResourceReference)
    {
        await this.resourcesManager.RemoveResourceStorageDirectory(resourceReference);
    }

    public async DeleteSecret(resourceReference: LightweightResourceReference, name: string)
    {
        return await this.remoteFileSystemManager.UnlinkFile(resourceReference.hostId, path.join(this.GetSecretsDir(resourceReference), name));
    }

    public async GenerateCertificate(resourceReference: LightweightResourceReference, type: "client" | "server", name: string)
    {
        const config = await this.QueryConfig(resourceReference.id);

        const caDir = this.GetCA_Dir(resourceReference);
        if(type === "client")
            await this.easyRSAManager.CreateClientKeyPair(resourceReference.hostId, caDir, name);
        else
            await this.easyRSAManager.CreateServerKeyPair(resourceReference.hostId, caDir, name, config.caConfig.keySize);

        config.state.certificates.push({
            generatedByCA: true,
            name,
            type
        });

        await this.UpdateConfig(resourceReference.id, config);
    }

    public GetCAPaths(resourceReference: LightweightResourceReference)
    {
        const caDir = this.GetCA_Dir(resourceReference);
        return this.easyRSAManager.GetCAPaths(caDir);
    }

    public async ImportCertificate(resourceReference: LightweightResourceReference, name: string, privateKey: string, cert: string)
    {
        const importDirs = this.GetImportedCertsDir(resourceReference);

        await this.remoteFileSystemManager.WriteTextFile(resourceReference.hostId, path.join(importDirs.certsDir, name + ".pem"), cert);
        await this.remoteFileSystemManager.WriteTextFile(resourceReference.hostId, path.join(importDirs.privateDir, name + ".pem"), privateKey, 0o600);

        const config = await this.QueryConfig(resourceReference.id);

        const idx = config.state.certificates.findIndex(x => (x.name === name) && (x.generatedByCA === false));
        if(idx !== -1)
            config.state.certificates.Remove(idx);

        config.state.certificates.push({
            generatedByCA: false,
            name,
            type: "server"
        });
        await this.UpdateConfig(resourceReference.id, config);
    }

    public async ListCertificates(resourceReference: LightweightResourceReference)
    {
        const config = await this.QueryConfig(resourceReference.id);
        return config.state.certificates;
    }

    public async ProvideResource(instanceProperties: KeyVaultProperties, context: DeploymentContext)
    {
        await this.resourcesManager.CreateResourceStorageDirectory(context.resourceReference);

        const keysDir = this.GetKeysDir(context.resourceReference);
        await this.remoteFileSystemManager.CreateDirectory(context.hostId, keysDir);
        await this.remoteFileSystemManager.ChangeMode(context.hostId, keysDir, 0o700);

        const secretsDir = this.GetSecretsDir(context.resourceReference);
        await this.remoteFileSystemManager.CreateDirectory(context.hostId, secretsDir);
        await this.remoteFileSystemManager.ChangeMode(context.hostId, secretsDir, 0o700);

        const importDirs = this.GetImportedCertsDir(context.resourceReference);
        await this.remoteFileSystemManager.CreateDirectory(context.hostId, path.join(importDirs.certsDir, ".."));
        await this.remoteFileSystemManager.CreateDirectory(context.hostId, importDirs.certsDir);

        await this.remoteFileSystemManager.CreateDirectory(context.hostId, importDirs.privateDir);
        await this.remoteFileSystemManager.ChangeMode(context.hostId, importDirs.privateDir, 0o700);
    }

    public async QueryCertificate(resourceReference: LightweightResourceReference, name: string)
    {
        const certs = await this.ListCertificates(resourceReference);
        const cert = certs.find(x => x.name === name);

        return cert;
    }

    public async QueryCertificatePaths(resourceReference: LightweightResourceReference, name: string): Promise<CertKeyPaths>
    {
        const cert = await this.QueryCertificate(resourceReference, name);

        if(cert === undefined)
            throw new Error("Cert '" + name + "' does not exist");

        if(cert.generatedByCA)
        {
            const caDir = this.GetCA_Dir(resourceReference);
            return this.easyRSAManager.GetCertAndKeyPaths(caDir, name);
        }

        const importPaths = this.GetImportedCertsDir(resourceReference);
        return {
            certPath: path.join(importPaths.certsDir, name + ".pem"),
            keyPath: path.join(importPaths.privateDir, name + ".pem"),
        }
    }

    public async QueryKeyNames(resourceReference: LightweightResourceReference)
    {
        return await this.remoteFileSystemManager.ListDirectoryContents(resourceReference.hostId, this.GetKeysDir(resourceReference));
    }

    public async QueryPKI_Config(resourceReference: LightweightResourceReference)
    {
        const config = await this.QueryConfig(resourceReference.id);
        return config.caConfig;
    }

    public QueryResourceState(resourceReference: LightweightResourceReference): ResourceStateResult
    {
        return "running";
    }

    public async QuerySecretNames(resourceReference: LightweightResourceReference)
    {
        return await this.remoteFileSystemManager.ListDirectoryContents(resourceReference.hostId, this.GetSecretsDir(resourceReference));
    }

    public async ReadCertificateInfo(resourceReference: LightweightResourceReference, name: string): Promise<KeyVaultCertificateInfo | undefined>
    {
        const cert = await this.QueryCertificate(resourceReference, name);
        if(cert === undefined)
            return undefined;
        const paths = await this.QueryCertificatePaths(resourceReference, name);

        const expiryDateContent = await this.remoteCommandExecutor.ExecuteBufferedCommand(["openssl", "x509", "-enddate", "-noout", "-in", paths.certPath], resourceReference.hostId);
        const parts = expiryDateContent.stdOut.split("=");
        const expiryDate = Date.parse(parts[1]);

        return {
            expiryDate: new Date(expiryDate),
            ...cert
        };
    }

    public async ReadCertificateWithPrivateKey(resourceReference: LightweightResourceReference, name: string)
    {
        const paths = await this.QueryCertificatePaths(resourceReference, name);
        const certData = await this.remoteFileSystemManager.ReadTextFile(resourceReference.hostId, paths.certPath);
        const keyData = await this.remoteFileSystemManager.ReadTextFile(resourceReference.hostId, paths.keyPath);

        return {
            certData,
            keyData
        };
    }

    public async ReadSecret(resourceReference: LightweightResourceReference, name: string)
    {
        return await this.remoteFileSystemManager.ReadTextFile(resourceReference.hostId, path.join(this.GetSecretsDir(resourceReference), name));
    }

    public async ReadSecretFromReference(keyVaultSecretReference: string)
    {
        const result = await this.ResolveKeyVaultReference(keyVaultSecretReference);
        return this.ReadSecret(result.kvRef, result.objectName);
    }

    public async ResolveKeyVaultReference(keyVaultReference: string)
    {
        const types: ("certificate" | "key" | "secret")[] = ["certificate", "key", "secret"];
        for (const type of types)
        {
            const parts = keyVaultReference.split("/" + type + "s/");
            if(parts.length === 2)
            {
                const kvRef = await this.resourcesManager.CreateResourceReferenceFromExternalId(parts[0]);
                return {
                    kvRef: kvRef!,
                    objectName: parts[1],
                    objectType: type
                }
            }
        }
        throw new Error("Malformed key vault reference: " + keyVaultReference);
    }

    public async RevokeCertificate(resourceReference: LightweightResourceReference, name: string)
    {
        const config = await this.QueryConfig(resourceReference.id);
        const certIdx = config.state.certificates.findIndex(x => x.name === name);
        if(certIdx === -1)
            throw new Error("Certificate '" + name + "' does not exist");

        const caDir = this.GetCA_Dir(resourceReference);
        await this.easyRSAManager.RevokeCertificate(resourceReference.hostId, caDir, name);

        config.state.certificates.Remove(certIdx);
        await this.UpdateConfig(resourceReference.id, config);

        this.resourceEventsManager.PublishEvent(securityServicesEvents.keyVault.certificateRevoked, resourceReference.id);
    }

    public async UpdatePKI_Config(resourceReference: LightweightResourceReference, caConfig: CA_Config)
    {
        const config = await this.QueryConfig(resourceReference.id);
        config.caConfig = caConfig;
        await this.UpdateConfig(resourceReference.id, config);

        const caDir = this.GetCA_Dir(resourceReference);
        const exists = await this.remoteFileSystemManager.Exists(resourceReference.hostId, caDir);
        if(exists)
            await this.remoteFileSystemManager.RemoveDirectoryRecursive(resourceReference.id, caDir);
        await this.easyRSAManager.CreateCA(resourceReference.hostId, caDir, caConfig);
    }

    //Private methods
    private GetCA_Dir(resourceReference: LightweightResourceReference)
    {
        const resourceDir = this.resourcesManager.BuildResourceStoragePath(resourceReference);
        const caDir = path.join(resourceDir, "ca");
        return caDir;
    }

    private GetKeysDir(resourceReference: LightweightResourceReference)
    {
        const resourceDir = this.resourcesManager.BuildResourceStoragePath(resourceReference);
        const secretsDir = path.join(resourceDir, "keys");
        return secretsDir;
    }

    private GetImportedCertsDir(resourceReference: LightweightResourceReference)
    {
        const resourceDir = this.resourcesManager.BuildResourceStoragePath(resourceReference);
        const importDir = path.join(resourceDir, "imported");
        return {
            certsDir: path.join(importDir, "certs"),
            privateDir: path.join(importDir, "private")
        };
    }

    private GetSecretsDir(resourceReference: LightweightResourceReference)
    {
        const resourceDir = this.resourcesManager.BuildResourceStoragePath(resourceReference);
        const secretsDir = path.join(resourceDir, "secrets");
        return secretsDir;
    }

    private async QueryConfig(resourceId: number): Promise<KeyVaultConfig>
    {
        const config = await this.resourceConfigController.QueryConfig<KeyVaultConfig>(resourceId);
        if(config === undefined)
        {
            return {
                caConfig: {
                    commonName: "",
                    keySize: 2048
                },
                state: {
                    certificates: []
                }
            };
        }
        return config;
    }

    private async UpdateConfig(resourceId: number, config: KeyVaultConfig)
    {
        await this.resourceConfigController.UpdateOrInsertConfig(resourceId, config);
    }
}