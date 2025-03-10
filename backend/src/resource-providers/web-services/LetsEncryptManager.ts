/**
 * OpenPrivateCloud
 * Copyright (C) 2019-2025 Amir Czwink (amir130@hotmail.de)
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
import { DeploymentContext, ResourceDeletionError, ResourceState } from "../ResourceProvider";
import { LetsEncryptProperties } from "./Properties";
import { LightweightResourceReference, ResourceReference } from "../../common/ResourceReference";
import { ResourceConfigController } from "../../data-access/ResourceConfigController";
import { ResourceDeploymentService } from "../../services/ResourceDeploymentService";
import { VirtualNetworkProperties } from "../network-services/properties";
import { ResourceGroupsController } from "../../data-access/ResourceGroupsController";
import { ResourceProviderManager } from "../../services/ResourceProviderManager";
import { HostFirewallSettingsManager } from "../../services/HostFirewallSettingsManager";
import { CIDRRange } from "../../common/CIDRRange";
import { VNetManager } from "../network-services/VNetManager";
import { PortForwardingRule } from "../../services/HostFirewallZonesManager";
import { DockerContainerConfig, DockerManager } from "../compute-services/DockerManager";
import { ManagedDockerContainerManager } from "../compute-services/ManagedDockerContainerManager";
import { ResourcesManager } from "../../services/ResourcesManager";
import { RemoteFileSystemManager } from "../../services/RemoteFileSystemManager";
import { TimeUtil } from "acts-util-core";
import { ResourceDependenciesController } from "../../data-access/ResourceDependenciesController";
import { KeyVaultManager } from "../security-services/KeyVaultManager";
import { RemoteRootFileSystemManager } from "../../services/RemoteRootFileSystemManager";
import { ResourceDeletionService } from "../../services/ResourceDeletionService";
import { UsersManager } from "../../services/UsersManager";

interface LetsEncryptCertBotConfig
{
    domainName: string;
    isRunning: boolean;
    keyVaultResourceId: number;
    sourcePort: number;
    userId: number;
    vNetAddressSpace: string;
}

const httpPort = 80;

@Injectable
export class LetsEncryptManager
{
    constructor(private resourceConfigController: ResourceConfigController, private resourceDeploymentService: ResourceDeploymentService, private resourceGroupsController: ResourceGroupsController, 
        private resourceProviderManager: ResourceProviderManager, private hostFirewallSettingsManager: HostFirewallSettingsManager, private vnetManager: VNetManager, private dockerManager: DockerManager,
        private managedDockerContainerManager: ManagedDockerContainerManager, private resourcesManager: ResourcesManager, private remoteFileSystemManager: RemoteFileSystemManager,
        private usersManager: UsersManager, private resourceDependenciesController: ResourceDependenciesController, private keyVaultManager: KeyVaultManager,
        private remoteRootFileSystemManager: RemoteRootFileSystemManager, private resourceDeletionService: ResourceDeletionService)
    {
    }

    //Public methods
    public async DeleteResource(resourceReference: LightweightResourceReference): Promise<ResourceDeletionError | null>
    {
        const config = await this.ReadConfig(resourceReference.id);
        if(config.isRunning)
        {
            return {
                type: "ConflictingState",
                message: "CertBot is currently running"
            };
        }

        await this.resourcesManager.RemoveResourceStorageDirectory(resourceReference);

        return null;
    }

    public async ProvideResource(instanceProperties: LetsEncryptProperties, context: DeploymentContext)
    {
        const kvRef = await this.resourcesManager.CreateResourceReferenceFromExternalId(instanceProperties.keyVaultExternalId);
        if(kvRef === undefined)
            throw new Error("Key vault does not exist");
        await this.resourceDependenciesController.EnsureResourceDependencyExists(kvRef.id, context.resourceReference.id);

        const config: LetsEncryptCertBotConfig = {
            domainName: instanceProperties.domainName,
            isRunning: false,
            keyVaultResourceId: kvRef.id,
            sourcePort: instanceProperties.sourcePort,
            userId: context.opcUserId,
            vNetAddressSpace: instanceProperties.vNetAddressSpace
        };
        await this.WriteConfig(context.resourceReference.id, config);

        const basePath = await this.resourcesManager.CreateResourceStorageDirectory(context.resourceReference);
        await this.remoteFileSystemManager.CreateDirectory(context.hostId, path.join(basePath, "etc"));
        await this.remoteFileSystemManager.CreateDirectory(context.hostId, path.join(basePath, "logs"));

        const emailAddress = await this.usersManager.QueryUsersEMailAddress(context.opcUserId);

        const command = ["certonly", "--cert-name", instanceProperties.domainName, "-v", "-d", instanceProperties.domainName, "--standalone", "-m", emailAddress, "--agree-tos"];
        await this.OrchestrateCertbotWorkflow(context.resourceReference, command);
    }

    public async QueryResourceState(resourceReference: LightweightResourceReference): Promise<ResourceState>
    {
        const config = await this.ReadConfig(resourceReference.id);
        if(config.isRunning)
            return ResourceState.Running;
        return ResourceState.Waiting;
    }

    public async ReadConfig(resourceId: number)
    {
        const configOptional = await this.resourceConfigController.QueryConfig<LetsEncryptCertBotConfig>(resourceId);
        return configOptional!;
    }

    public async ReadExpiryDate(resourceReference: LightweightResourceReference)
    {
        const config = await this.ReadConfig(resourceReference.id);
        const kvRef = await this.resourcesManager.CreateResourceReference(config.keyVaultResourceId);

        const cert = await this.keyVaultManager.ReadCertificateInfo(kvRef!, config.domainName);

        return cert?.expiryDate;
    }

    public async RenewCertificateIfRequired(resourceReference: ResourceReference)
    {
        const nDays = await this.RequestNumberOfRemainingValidDays(resourceReference);
        if(nDays <= 30) //letsencrypt recommends renewing after 60 days. Cert is valid for 90 days.
            await this.RenewCertificate(resourceReference);
    }

    public async RequestLogs(resourceReference: LightweightResourceReference)
    {
        const baseDir = this.resourcesManager.BuildResourceStoragePath(resourceReference);
        const logPath = path.join(baseDir, "logs", "letsencrypt.log");

        return await this.remoteFileSystemManager.ReadTextFile(resourceReference.hostId, logPath);
    }

    public async RequestNumberOfRemainingValidDays(resourceReference: LightweightResourceReference)
    {
        const expiryDate = await this.ReadExpiryDate(resourceReference);
        return this.keyVaultManager.ComputeNumberOfRemainingValidDays(expiryDate!);
    }

    public async WriteConfig(resourceId: number, config: LetsEncryptCertBotConfig)
    {
        await this.resourceConfigController.UpdateOrInsertConfig(resourceId, config);
    }

    //Private methods
    private async CleanUpCertbotExecution(resourceReference: LightweightResourceReference, vNetRef: ResourceReference, originalPort: number, originalPortForwardingRule: PortForwardingRule | undefined)
    {
        await this.hostFirewallSettingsManager.DeletePortForwardingRule(vNetRef.hostId, "TCP", originalPort);
        if(originalPortForwardingRule !== undefined)
            await this.hostFirewallSettingsManager.AddPortForwardingRule(vNetRef.hostId, originalPortForwardingRule);

        await this.hostFirewallSettingsManager.DeleteRule(vNetRef.hostId, "Inbound", 1);

        await this.resourceDeletionService.DeleteResource(vNetRef);

        const config = await this.ReadConfig(resourceReference.id);
        config.isRunning = false;
        await this.WriteConfig(resourceReference.id, config);
    }

    private async DeployVNet(resourceReference: ResourceReference, config: LetsEncryptCertBotConfig)
    {
        const random = crypto.pseudoRandomBytes(32).toString("hex");

        const vNetProps: VirtualNetworkProperties = {
            addressSpace: config.vNetAddressSpace,
            enableDHCPv4: true,
            hostName: resourceReference.hostName,
            name: "DONT_TOUCH_LetsEncryptVNet_" + random,
            type: "virtual-network"
        };
        const rg = await this.resourceGroupsController.QueryGroupByName(resourceReference.resourceGroupName);
        const vNetRef = await this.resourceDeploymentService.StartInstanceDeployment(vNetProps, rg!, resourceReference.hostId, config.userId);

        for(let i = 0; i <= 60 * 60; i += 5) //try for one hour
        {
            await TimeUtil.Delay(5000);

            const state = await this.resourceProviderManager.QueryResourceState(vNetRef);
            switch(state)
            {
                case ResourceState.Running:
                    return vNetRef;
                default:
                    throw new Error("Deployment of vnet failed");
            }
        }

        throw new Error("Deployment of vnet failed");
    }

    private DeriveContainerName(resourceId: number)
    {
        return "opc-rlecb-" + resourceId;
    }

    private async ImportCertificateIntoKeyVault(resourceReference: LightweightResourceReference)
    {
        const config = await this.ReadConfig(resourceReference.id);

        const baseDir = this.resourcesManager.BuildResourceStoragePath(resourceReference);
        const domainDir = path.join(baseDir, "etc", "live", config.domainName);

        const cert = await this.remoteRootFileSystemManager.ReadTextFile(resourceReference.hostId, path.join(domainDir, "fullchain.pem"));
        const privateKey = await this.remoteRootFileSystemManager.ReadTextFile(resourceReference.hostId, path.join(domainDir, "privkey.pem"));

        const kvRef = await this.resourcesManager.CreateResourceReference(config.keyVaultResourceId);

        await this.keyVaultManager.ImportCertificate(kvRef!, config.domainName, privateKey, cert);
    }

    private async PrepareCertbotExecution(resourceReference: ResourceReference)
    {
        const config = await this.ReadConfig(resourceReference.id);
        config.isRunning = true;
        await this.WriteConfig(resourceReference.id, config);
        
        const vNetRef = await this.DeployVNet(resourceReference, config);
        await this.vnetManager.SetFirewallRule(vNetRef, "Inbound", {
            action: "Allow",
            comment: "Allow http for certbot verification",
            destination: "Any",
            destinationPortRanges: httpPort.toString(),
            priority: 1,
            protocol: "TCP",
            source: "Any"
        });

        await this.hostFirewallSettingsManager.SetRule(resourceReference.hostId, "Inbound", {
            action: "Allow",
            comment: "Allow http for certbot verification",
            destination: "Any",
            destinationPortRanges: config.sourcePort.toString(),
            priority: 1,
            protocol: "TCP",
            source: "Any"
        });

        const portForwardingRules = await this.hostFirewallSettingsManager.QueryPortForwardingRules(resourceReference.hostId);
        const originalPortForwardingRule = portForwardingRules.find(x => (x.port === config.sourcePort) && (x.protocol === "TCP"));

        if(originalPortForwardingRule !== undefined)
            await this.hostFirewallSettingsManager.DeletePortForwardingRule(resourceReference.hostId, "TCP", config.sourcePort);

        const containerAddress = new CIDRRange(config.vNetAddressSpace).netAddress.Next().Next();
        await this.hostFirewallSettingsManager.AddPortForwardingRule(resourceReference.hostId, {
            port: config.sourcePort,
            protocol: "TCP",
            targetAddress: containerAddress.ToString(),
            targetPort: httpPort,
            externalZoneOnly: false
        });
        await TimeUtil.Delay(5000); //wait for firewall to refresh

        return {
            vNetRef,
            originalPortForwardingRule,
            sourcePort: config.sourcePort,
        };
    }

    private async RenewCertificate(resourceReference: ResourceReference)
    {
        const config = await this.ReadConfig(resourceReference.id);

        const command = ["renew", "--cert-name", config.domainName, "--no-random-sleep-on-renew"];
        await this.OrchestrateCertbotWorkflow(resourceReference, command);
    }

    private async OrchestrateCertbotWorkflow(resourceReference: ResourceReference, command: string[])
    {
        const state = await this.PrepareCertbotExecution(resourceReference);
        try
        {
            await this.RunCommandInContainer(resourceReference, state.vNetRef, command);
        }
        finally
        {
            await this.CleanUpCertbotExecution(resourceReference, state.vNetRef, state.sourcePort, state.originalPortForwardingRule);
        }

        await this.ImportCertificateIntoKeyVault(resourceReference);
    }

    private async RunCommandInContainer(resourceReference: LightweightResourceReference, vNetResourceReference: LightweightResourceReference, command: string[])
    {
        const baseDir = this.resourcesManager.BuildResourceStoragePath(resourceReference);
        const dockerNetwork = await this.managedDockerContainerManager.ResolveVNetToDockerNetwork(vNetResourceReference);

        const containerConfig: DockerContainerConfig = {
            additionalHosts: [],
            capabilities: [],
            dnsSearchDomains: [],
            dnsServers: [dockerNetwork.primaryDNS_Server],
            env: [],
            imageName: "certbot/certbot",
            macAddress: this.dockerManager.CreateMAC_Address(resourceReference.id),
            networkName: dockerNetwork.name,
            portMap: [],
            privileged: false,
            removeOnExit: true,
            restartPolicy: "no",
            volumes: [
                {
                    containerPath: "/etc/letsencrypt",
                    hostPath: path.join(baseDir, "etc"),
                    readOnly: false
                },
                {
                    containerPath: "/var/log/letsencrypt",
                    hostPath: path.join(baseDir, "logs"),
                    readOnly: false
                }
            ]
        };

        const containerName = this.DeriveContainerName(resourceReference.id);
        await this.dockerManager.CreateContainerInstanceAndStartItAndExecuteCommand(resourceReference.hostId, containerName, containerConfig, command);
    }
}