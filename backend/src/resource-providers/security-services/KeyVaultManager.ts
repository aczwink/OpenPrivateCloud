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
import { CA_Config, EasyRSAManager } from "./EasyRSAManager";
import { ResourceConfigController } from "../../data-access/ResourceConfigController";

interface KeyVaultCertificate
{
    name: string;
    type: "client" | "server";
    generatedByCA: boolean;
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
    constructor(private resourcesManager: ResourcesManager, private remoteFileSystemManager: RemoteFileSystemManager, private resourceConfigController: ResourceConfigController, private easyRSAManager: EasyRSAManager)
    {
    }

    //Public methods
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

    public async ListCertificates(resourceReference: LightweightResourceReference)
    {
        const config = await this.QueryConfig(resourceReference.id);
        return config.state.certificates;
    }

    public async ProvideResource(instanceProperties: KeyVaultProperties, context: DeploymentContext)
    {
        await this.resourcesManager.CreateResourceStorageDirectory(context.resourceReference);
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