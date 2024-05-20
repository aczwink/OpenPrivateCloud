/**
 * OpenPrivateCloud
 * Copyright (C) 2024 Amir Czwink (amir130@hotmail.de)
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
import { Injectable } from "acts-util-node";
import { DeploymentContext } from "../ResourceProvider";
import { WAFProperties } from "./properties";
import { LightweightResourceReference } from "../../common/ResourceReference";
import { ManagedDockerContainerManager } from "../compute-services/ManagedDockerContainerManager";
import { ResourcesManager } from "../../services/ResourcesManager";
import { DockerContainerConfig } from "../compute-services/DockerManager";
import { ResourceConfigController } from "../../data-access/ResourceConfigController";
import { RemoteFileSystemManager } from "../../services/RemoteFileSystemManager";

export interface WAFConfig
{
    backend: string;

    httpPort: number;

    preventionOn: boolean;

    /**
     * @title Virtual network
     * @format instance-same-host[network-services/virtual-network]
     */
    vnetResourceExternalId: string;
}

interface WAFMatchMessage
{
    ruleId: string;
    message: string;
    data: string;
}

interface WAFRuleMatch
{
    timeStamp: string;
    httpMethod: string;
    uri: string;
    messages: WAFMatchMessage[];
    clientIP: string;
}

@Injectable
export class WAFManager
{
    constructor(private managedDockerContainerManager: ManagedDockerContainerManager, private resourcesManager: ResourcesManager, private resourceConfigController: ResourceConfigController, private remoteFileSystemManager: RemoteFileSystemManager)
    {
    }

    public async DeleteResource(resourceReference: LightweightResourceReference)
    {
        await this.managedDockerContainerManager.DestroyContainer(resourceReference);

        await this.resourcesManager.RemoveResourceStorageDirectory(resourceReference);
    }
    
    public async ProvideResource(instanceProperties: WAFProperties, context: DeploymentContext)
    {
        await this.UpdateConfig(context.resourceReference.id, {
            backend: "http://localhost:80",
            httpPort: 80,
            preventionOn: true,
            vnetResourceExternalId: instanceProperties.vnetResourceExternalId
        });

        this.UpdateService(context.resourceReference);
    }

    public async QueryInfo(resourceReference: LightweightResourceReference)
    {
        return await this.managedDockerContainerManager.ExtractContainerInfo(resourceReference);
    }

    public async QueryLog(resourceReference: LightweightResourceReference)
    {
        const log = await this.managedDockerContainerManager.QueryLog(resourceReference);
        return log;
    }

    public async QueryHealthStatus(resourceReference: LightweightResourceReference)
    {
        return await this.managedDockerContainerManager.QueryHealthStatus(resourceReference);
    }

    public QuerySettings(resourceReference: LightweightResourceReference)
    {
        return this.ReadConfig(resourceReference.id);
    }

    public async RequestFirewallMatches(resourceReference: LightweightResourceReference)
    {
        function MapMessage(m: any): WAFMatchMessage
        {
            return {
                data: m.details.data,
                message: m.message,
                ruleId: m.details.ruleId
            };
        }
        const log = await this.managedDockerContainerManager.QueryLog(resourceReference);

        const parts = log.stdOut.split("\n").filter(x => x.startsWith("{")).map(x => JSON.parse(x));
        const matches: WAFRuleMatch[] = parts.map(x => x.transaction).map(t => ({
            clientIP: t.client_ip,
            httpMethod: t.request.method,
            messages: t.messages.map(MapMessage),
            timeStamp: t.time_stamp,
            uri: t.request.uri
        }));

        return matches;
    }

    public async UpdateSettings(resourceReference: LightweightResourceReference, settings: WAFConfig)
    {
        await this.UpdateConfig(resourceReference.id, settings);
        await this.UpdateService(resourceReference);
    }

    //Private methods
    private async ReadConfig(resourceId: number): Promise<WAFConfig>
    {
        const config = await this.resourceConfigController.QueryConfig<WAFConfig>(resourceId);
        return config!;
    }

    private async UpdateConfig(resourceId: number, config: WAFConfig)
    {
        await this.resourceConfigController.UpdateOrInsertConfig(resourceId, config);
    }

    private async UpdateService(resourceReference: LightweightResourceReference)
    {
        const config = await this.ReadConfig(resourceReference.id);
        const vNetRef = await this.resourcesManager.CreateResourceReferenceFromExternalId(config.vnetResourceExternalId);

        const dockerNetwork = await this.managedDockerContainerManager.ResolveVNetToDockerNetwork(vNetRef!);
        const containerConfig: DockerContainerConfig = {
            additionalHosts: [],
            capabilities: [],
            dnsSearchDomains: [],
            dnsServers: [dockerNetwork.primaryDNS_Server],
            env: [
                {
                    varName: "BACKEND",
                    value: config.backend
                },
                {
                    varName: "MODSEC_AUDIT_ENGINE",
                    value: "RelevantOnly"
                },
                {
                    varName: "MODSEC_RULE_ENGINE",
                    value: config.preventionOn ? "On" : "DetectionOnly"
                },
                {
                    varName: "PORT",
                    value: config.httpPort.toString()
                }
            ],
            macAddress: this.managedDockerContainerManager.CreateMAC_Address(resourceReference.id),
            imageName: "owasp/modsecurity-crs:nginx",
            networkName: dockerNetwork.name,
            portMap: [],
            privileged: false,
            removeOnExit: false,
            restartPolicy: "always",
            volumes: [
            ]
        };
        await this.managedDockerContainerManager.EnsureContainerIsRunning(resourceReference, containerConfig);
    }
}