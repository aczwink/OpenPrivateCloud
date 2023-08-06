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
    public async CreateSecret(resourceReference: LightweightResourceReference, name: string, value: string)
    {
        const secretPath = path.join(this.GetSecretsDir(resourceReference), name);
        await this.remoteFileSystemManager.WriteTextFile(resourceReference.hostId, secretPath, value);
    }

    public async DeleteResource(resourceReference: LightweightResourceReference)
    {
        await this.resourcesManager.RemoveResourceStorageDirectory(resourceReference);
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

    public async QueryPKI_Config(resourceReference: LightweightResourceReference)
    {
        const config = await this.QueryConfig(resourceReference.id);
        return config.caConfig;
    }

    public QueryResourceState(resourceReference: LightweightResourceReference): ResourceStateResult
    {
        return "running";
    }

    public async QuerySecret(resourceReference: LightweightResourceReference, name: string)
    {
        return await this.remoteFileSystemManager.ReadTextFile(resourceReference.hostId, path.join(this.GetSecretsDir(resourceReference), name));
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