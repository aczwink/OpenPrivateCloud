/**
 * OpenPrivateCloud
 * Copyright (C) 2019-2024 Amir Czwink (amir130@hotmail.de)
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
import { ResourcesManager } from "../../services/ResourcesManager";
import { ResourceConfigController } from "../../data-access/ResourceConfigController";
import { RemoteCommandExecutor } from "../../services/RemoteCommandExecutor";
import { OpenVPNServerConfig } from "./models";
import { RemoteFileSystemManager } from "../../services/RemoteFileSystemManager";
import { SystemServicesManager } from "../../services/SystemServicesManager";
import { RemoteRootFileSystemManager } from "../../services/RemoteRootFileSystemManager";
import { ConfigDialect } from "../../common/config/ConfigDialect";
import path from "path";
import { Dictionary } from "acts-util-core";
import { CIDRRange } from "../../common/CIDRRange";
import { LightweightResourceReference } from "../../common/ResourceReference";
import { DeploymentContext, ResourceCheckResult, ResourceCheckType, ResourceState } from "../ResourceProvider";
import { SysCtlConfService } from "./SysCtlConfService";
import { OpenVPNGatewayProperties } from "./properties";
import { FirewallZoneData, FirewallZoneDataProvider } from "../../services/HostFirewallZonesManager";
import { KeyVaultManager } from "../security-services/KeyVaultManager";
import { CA_FilePaths, CertKeyPaths } from "../security-services/EasyRSAManager";
import { ResourceEvent, ResourceEventListener } from "../../services/ResourceEventsManager";
import { ResourceDependenciesController } from "../../data-access/ResourceDependenciesController";
import { resourceProviders } from "openprivatecloud-common";
import { HostSysLogBootDataProvider } from "../../services/data-providers/HostLogDataProviderService";
import { HealthStatus } from "../../data-access/HealthController";

export interface OpenVPNGatewayConnectedClientEntry
{
    "Common Name": string;
    "Real Address": string;
    "Virtual Address": string;
    "Bytes Received": number;
    "Bytes Sent": number;
    "Connected Since": string;
    "Data Channel Cipher": string;
}

export interface OpenVPNGatewayPublicEndpointConfig
{
    domainName: string;
    dnsServerAddress: string;
    /**
     * @default 1194
     */
    port: number;
}

export interface OpenVPNGatewayInternalConfig
{
    server: OpenVPNServerConfig;

    /**
     * @title Key-Vault
     * @format instance-same-host[security-services/key-vault]
     */
    keyVaultExternalId: string;

    publicEndpoint: OpenVPNGatewayPublicEndpointConfig;
}

const openVPNConfigDialect: ConfigDialect = {
    commentInitiators: ["#"]
}

@Injectable
export class OpenVPNGatewayManager implements FirewallZoneDataProvider, ResourceEventListener
{
    constructor(private resourcesManager: ResourcesManager, private resourceConfigController: ResourceConfigController, private sysCtlConfService: SysCtlConfService,
        private remoteCommandExecutor: RemoteCommandExecutor, private remoteFileSystemManager: RemoteFileSystemManager, private keyVaultManager: KeyVaultManager,
        private systemServicesManager: SystemServicesManager, private remoteRootFileSystemManager: RemoteRootFileSystemManager, private resourceDependenciesController: ResourceDependenciesController)
    {
    }

    //Properties
    public get matchingZonePrefix(): string
    {
        return "vpn-";
    }
    
    //Public methods
    public async CheckResource(resourceReference: LightweightResourceReference, type: ResourceCheckType): Promise<HealthStatus | ResourceCheckResult>
    {
        switch(type)
        {
            case ResourceCheckType.Availability:
            {
                const serviceName = this.DeriveSystemDServiceName(resourceReference.id);
                const isActive = await this.systemServicesManager.IsServiceActive(resourceReference.hostId, serviceName);
                if(!isActive)
                {
                    const exists = await this.systemServicesManager.DoesServiceUnitExist(resourceReference.hostId, serviceName);
                    if(!exists)
                        return { status: HealthStatus.Corrupt, context: "service does not exist" };
                    return { status: HealthStatus.Down, context: "service is not active" };
                }
            }
            break;
            case ResourceCheckType.ServiceHealth:
                await this.DeployHostConfiguration(resourceReference);
            break;
        }

        return HealthStatus.Up;
    }
    
    public async DeleteResource(resourceReference: LightweightResourceReference)
    {
        await this.StopServer(resourceReference.hostId, resourceReference.id);

        const configPath = this.BuildConfigPath(resourceReference.id);
        if(await this.remoteFileSystemManager.Exists(resourceReference.hostId, configPath))
            await this.remoteRootFileSystemManager.RemoveFile(resourceReference.hostId, configPath);
        
        await this.systemServicesManager.Reload(resourceReference.hostId);
        
        await this.resourcesManager.RemoveResourceStorageDirectory(resourceReference);
    }

    public async GenerateClientConfig(resourceReference: LightweightResourceReference, clientName: string)
    {
        const hostId = resourceReference.hostId;
        const config = await this.ReadConfig(resourceReference.id);

        const keyRef = await this.resourcesManager.CreateResourceReferenceFromExternalId(config.keyVaultExternalId);

        const caPaths = this.keyVaultManager.GetCAPaths(keyRef!);
        const cert = await this.keyVaultManager.ReadCertificateWithPrivateKey(keyRef!, clientName);
        const resourceDir = this.resourcesManager.BuildResourceStoragePath(resourceReference);

        const serverConfig = config.server;

        const caCertData = await this.remoteFileSystemManager.ReadTextFile(hostId, caPaths.caCertPath);
        const taData = await this.remoteFileSystemManager.ReadTextFile(hostId, resourceDir + "/ta.key");
        
        return `
client
dev tun
resolv-retry infinite
nobind
persist-key
persist-tun
remote-cert-tls server
key-direction 1

proto ${serverConfig.protocol}
remote ${config.publicEndpoint.domainName} ${config.publicEndpoint.port}
cipher ${serverConfig.cipher}
verb ${serverConfig.verbosity}
auth ${serverConfig.authenticationAlgorithm}
auth-nocache
key-direction 1

redirect-gateway def1
script-security 2
dhcp-option DNS ${config.publicEndpoint.dnsServerAddress}

<ca>
${caCertData}
</ca>
<cert>
${cert.certData}
</cert>
<key>
${cert.keyData}
</key>
<tls-auth>
${taData}
</tls-auth>
`;
    }

    public GetLogDataProvider(resourceReference: LightweightResourceReference)
    {
        return new HostSysLogBootDataProvider(resourceReference.hostId, ["-u", this.DeriveSystemDServiceName(resourceReference.id)]);
    }

    public async ListClients(resourceReference: LightweightResourceReference)
    {
        const config = await this.ReadConfig(resourceReference.id);
        const keyRef = await this.resourcesManager.CreateResourceReferenceFromExternalId(config.keyVaultExternalId);

        const certs = await this.keyVaultManager.ListCertificates(keyRef!);
        return certs.Values().Filter(x => x.generatedByCA && (x.type === "client")).Map(x => x.name);
    }

    public MatchNetworkInterfaceName(nicName: string): string | null
    {
        if(nicName.startsWith("opc-ovpn"))
            return this.matchingZonePrefix + nicName.substring(8);
        return null;
    }

    public async ProvideData(hostId: number, zoneName: string): Promise<FirewallZoneData>
    {
        const resourceId = parseInt(zoneName.substring(this.matchingZonePrefix.length));
        const config = await this.ReadConfig(resourceId);

        return {
            addressSpace: new CIDRRange(config.server.virtualServerAddressRange),
            inboundRules: [],
            outboundRules: [],
            portForwardingRules: []
        };
    }

    public async ProvideResource(instanceProperties: OpenVPNGatewayProperties, context: DeploymentContext)
    {
        const resourceDir = await this.resourcesManager.CreateResourceStorageDirectory(context.resourceReference);

        await this.UpdateConfig(context.resourceReference.id, {
            server: this.CreateDefaultConfig(),
            keyVaultExternalId: instanceProperties.keyVaultExternalId,
            publicEndpoint: instanceProperties.publicEndpoint,
        });

        const keyRef = await this.resourcesManager.CreateResourceReferenceFromExternalId(instanceProperties.keyVaultExternalId);
        await this.resourceDependenciesController.EnsureResourceDependencyExists(keyRef!.id, context.resourceReference.id);

        await this.remoteCommandExecutor.ExecuteCommand(["/usr/sbin/openvpn", "--genkey", "--secret", resourceDir + "/ta.key"], context.hostId);

        await this.DeployHostConfiguration(context.resourceReference);
    }

    public async QueryResourceState(resourceReference: LightweightResourceReference): Promise<ResourceState>
    {
        return ResourceState.Running;
    }

    public async ReadConfig(resourceId: number): Promise<OpenVPNGatewayInternalConfig>
    {
        const config = await this.resourceConfigController.QueryConfig<OpenVPNGatewayInternalConfig>(resourceId);
        if(config?.server === undefined)
            config!.server = this.CreateDefaultConfig(); //TODO REMOVE THIS
        return config!;
    }

    public async ReadInstanceStatus(resourceReference: LightweightResourceReference)
    {
        const instanceDir = this.resourcesManager.BuildResourceStoragePath(resourceReference);

        const statusText = await this.remoteRootFileSystemManager.ReadTextFile(resourceReference.hostId, path.join(instanceDir, "openvpn-status.log"));
        const lines = statusText.split("\n");

        let lastHeaderFields: string[] = [];
        const clients: OpenVPNGatewayConnectedClientEntry[] = [];
        for (const line of lines)
        {
            const parts = line.split(",");
            const type = parts[0];
            parts.Remove(0);

            if(type === "END")
                break;

            switch(type)
            {
                case "CLIENT_LIST":
                    const client: Dictionary<string> = {};
                    for(let i = 1; i < lastHeaderFields.length; i++)
                        client[lastHeaderFields[i]] = parts[i - 1];
                    clients.push(client as any);
                    break;
                case "HEADER":
                    lastHeaderFields = parts;
                    break;
                case "GLOBAL_STATS":
                case "ROUTING_TABLE":
                case "TITLE":
                case "TIME":
                    //ignore
                    break;
            }
        }

        return clients;
    }

    public async ReceiveResourceEvent(event: ResourceEvent): Promise<void>
    {
        if(event.type === "keyVault/certificateRevoked")
        {
            const resourceIds = await this.resourceDependenciesController.QueryResourcesThatDependOn(resourceProviders.networkServices.name, resourceProviders.networkServices.openVPNGatewayResourceType.name, event.keyVaultResourceId);
            for (const resourceId of resourceIds)
            {
                const ref = await this.resourcesManager.CreateResourceReference(resourceId);
                await this.RestartServer(ref!.hostId, ref!.id);
            }
        }
    }

    public async UpdateServiceConfiguration(resourceReference: LightweightResourceReference, serverConfig: OpenVPNServerConfig, publicEndpointConfig: OpenVPNGatewayPublicEndpointConfig)
    {
        const config = await this.ReadConfig(resourceReference.id);

        config.publicEndpoint = publicEndpointConfig;
        config.server = serverConfig;

        await this.UpdateConfig(resourceReference.id, config);
        await this.DeployHostConfiguration(resourceReference);
        await this.RestartServer(resourceReference.hostId, resourceReference.id);
    }

    //Private methods
    private async AutoStartServer(hostId: number, resourceId: number)
    {
        const serviceName = this.DeriveSystemDServiceName(resourceId);

        await this.systemServicesManager.EnableService(hostId, serviceName);
        await this.systemServicesManager.StartService(hostId, serviceName);
    }

    private BuildConfigPath(resourceId: number)
    {
        const name = this.DeriveServerName(resourceId);
        return "/etc/openvpn/server/" + name + ".conf";
    }

    private CreateDefaultConfig(): OpenVPNServerConfig
    {
        return {
            authenticationAlgorithm: "SHA256",
            cipher: "AES-256-CBC",
            port: 1194,
            protocol: "udp",
            verbosity: 3,
            virtualServerAddressRange: "10.8.0.0/24",
        };
    }

    private async CreateServerConfig(hostId: number, serverDir: string, resourceId: number, data: OpenVPNServerConfig, caFilePaths: CA_FilePaths, serverCertKeyFilePaths: CertKeyPaths)
    {
        const nicName = "opc-ovpn" + resourceId;
        const range = new CIDRRange(data.virtualServerAddressRange);

        const config = `
dev ${nicName}
dev-type tun
topology subnet
keepalive 10 120
user nobody
group nogroup
persist-key
persist-tun
remote-cert-tls client

ifconfig-pool-persist ${serverDir}/ipp.txt
tls-auth ${serverDir}/ta.key 0
status ${serverDir}/openvpn-status.log

server ${range.netAddress.ToString()} ${range.GenerateSubnetMask().ToString()}
port ${data.port}
proto ${data.protocol}
cipher ${data.cipher}
auth ${data.authenticationAlgorithm}
verb ${data.verbosity}

ca ${caFilePaths.caCertPath}
cert ${serverCertKeyFilePaths.certPath}
key ${serverCertKeyFilePaths.keyPath}
dh ${caFilePaths.dhPath}
crl-verify ${caFilePaths.crlPath}
        `;

        await this.remoteRootFileSystemManager.WriteTextFile(hostId, this.BuildConfigPath(resourceId), config);

        await this.systemServicesManager.Reload(hostId);
    }

    private async DeployHostConfiguration(resourceReference: LightweightResourceReference)
    {
        await this.sysCtlConfService.SetIPForwardingState(resourceReference.hostId, true);

        const config = await this.ReadConfig(resourceReference.id);
        const keyRef = await this.resourcesManager.CreateResourceReferenceFromExternalId(config.keyVaultExternalId);

        const caPaths = this.keyVaultManager.GetCAPaths(keyRef!);
        const serverCertPaths = await this.keyVaultManager.QueryCertificatePaths(keyRef!, config.publicEndpoint.domainName);
        const resourceDir = this.resourcesManager.BuildResourceStoragePath(resourceReference);

        await this.CreateServerConfig(resourceReference.hostId, resourceDir, resourceReference.id, config.server, caPaths, serverCertPaths);
        await this.AutoStartServer(resourceReference.hostId, resourceReference.id);
    }

    private DeriveServerName(resourceId: number)
    {
        return "opc-rovpng-" + resourceId;
    }

    private DeriveSystemDServiceName(resourceId: number)
    {
        const name = this.DeriveServerName(resourceId);
        return "openvpn-server@" + name;
    }

    private async RestartServer(hostId: number, resourceId: number)
    {
        const serviceName = this.DeriveSystemDServiceName(resourceId);
        await this.systemServicesManager.RestartService(hostId, serviceName);
    }

    private async StopServer(hostId: number, resourceId: number)
    {
        const serviceName = this.DeriveSystemDServiceName(resourceId);
        await this.systemServicesManager.StopService(hostId, serviceName);
        await this.systemServicesManager.DisableService(hostId, serviceName);
    }

    private async UpdateConfig(instanceId: number, config: OpenVPNGatewayInternalConfig)
    {
        await this.resourceConfigController.UpdateOrInsertConfig(instanceId, config);
    }
}