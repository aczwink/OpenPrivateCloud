/**
 * OpenPrivateCloud
 * Copyright (C) 2019-2023 Amir Czwink (amir130@hotmail.de)
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
import { InstancesManager } from "../../services/InstancesManager";
import { InstanceConfigController } from "../../data-access/InstanceConfigController";
import { RemoteCommandExecutor } from "../../services/RemoteCommandExecutor";
import { CertKeyFiles, OpenVPNServerConfig } from "./models";
import { RemoteFileSystemManager } from "../../services/RemoteFileSystemManager";
import { SystemServicesManager } from "../../services/SystemServicesManager";
import { RemoteRootFileSystemManager } from "../../services/RemoteRootFileSystemManager";
import { ConfigParser, KeyValueEntry } from "../../common/config/ConfigParser";
import { ConfigDialect } from "../../common/config/ConfigDialect";
import { ConfigModel } from "../../common/config/ConfigModel";
import { ConfigWriter } from "../../common/config/ConfigWriter";
import { InstanceContext } from "../../common/InstanceContext";
import path from "path";
import { Dictionary } from "acts-util-core";
import { HostNATService } from "../../services/HostNATService";
import { CIDRRange } from "../../common/CIDRRange";

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
    port: number;
}

export interface OpenVPNGatewayInternalConfig
{
    pki: {
        keySize: 2048 | 4096;
    };
    publicEndpoint: OpenVPNGatewayPublicEndpointConfig;
}

interface OpenVPNGatewayLogEntry
{
    message: string;
}

const openVPNConfigDialect: ConfigDialect = {
    commentInitiators: ["#"]
}

@Injectable
export class OpenVPNGatewayManager
{
    constructor(private instancesManager: InstancesManager, private instanceConfigController: InstanceConfigController,
        private remoteCommandExecutor: RemoteCommandExecutor, private remoteFileSystemManager: RemoteFileSystemManager,
        private systemServicesManager: SystemServicesManager, private remoteRootFileSystemManager: RemoteRootFileSystemManager,
        private hostNATService: HostNATService)
    {
    }
    
    //Public methods
    public async AutoStartServer(hostId: number, fullInstanceName: string)
    {
        const config = await this.ReadServerConfig(hostId, fullInstanceName);
        await this.hostNATService.AddSourceNATRule(hostId, config.virtualServerAddressRange);

        const serviceName = this.DeriveSystemDServiceNameFromFullInstanceName(fullInstanceName);

        await this.systemServicesManager.EnableService(hostId, serviceName);
        await this.systemServicesManager.StartService(hostId, serviceName);
    }

    public BuildConfigPath(fullInstanceName: string)
    {
        const name = this.instancesManager.DeriveInstanceFileNameFromUniqueInstanceName(fullInstanceName);
        return "/etc/openvpn/server/" + name + ".conf";
    }

    public CreateDefaultConfig(): OpenVPNServerConfig
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

    public async CreateServerConfig(hostId: number, serverDir: string, fullInstanceName: string, data: OpenVPNServerConfig, certKeyFiles: CertKeyFiles)
    {
        await this.remoteCommandExecutor.ExecuteCommand(["/usr/sbin/openvpn", "--genkey", "--secret", serverDir + "/ta.key"], hostId);

        const range = new CIDRRange(data.virtualServerAddressRange);
        const config = `
dev tun
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
log ${serverDir}/openvpn.log

server ${range.netAddress} ${range.GenerateSubnetMask()}
port ${data.port}
proto ${data.protocol}
cipher ${data.cipher}
auth ${data.authenticationAlgorithm}
verb ${data.verbosity}

ca ${certKeyFiles.caCertPath}
cert ${certKeyFiles.certPath}
key ${certKeyFiles.keyPath}
dh ${certKeyFiles.dhPath}
crl-verify ${certKeyFiles.crlPath}
        `;

        await this.remoteRootFileSystemManager.WriteTextFile(hostId, this.BuildConfigPath(fullInstanceName), config);

        await this.systemServicesManager.Reload(hostId);
    }

    public async GenerateClientConfig(hostId: number, instanceId: number, serverDir: string, fullInstanceName: string, clientCertKeyPaths: CertKeyFiles)
    {
        const serverConfig = await this.ReadServerConfig(hostId, fullInstanceName);
        const instanceConfig = await this.ReadInstanceConfig(instanceId);

        const caCertData = await this.remoteFileSystemManager.ReadTextFile(hostId, clientCertKeyPaths.caCertPath);
        const certData = await this.remoteFileSystemManager.ReadTextFile(hostId, clientCertKeyPaths.certPath);
        const keyData = await this.remoteFileSystemManager.ReadTextFile(hostId, clientCertKeyPaths.keyPath);
        const taData = await this.remoteFileSystemManager.ReadTextFile(hostId, serverDir + "/ta.key");
        
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
remote ${instanceConfig.publicEndpoint.domainName} ${instanceConfig.publicEndpoint.port}
cipher ${serverConfig.cipher}
verb ${serverConfig.verbosity}
auth ${serverConfig.authenticationAlgorithm}
auth-nocache
key-direction 1

redirect-gateway def1
script-security 2
dhcp-option DNS ${instanceConfig.publicEndpoint.dnsServerAddress}

<ca>
${caCertData}
</ca>
<cert>
${certData}
</cert>
<key>
${keyData}
</key>
<tls-auth>
${taData}
</tls-auth>
`;
    }

    public async ReadInstanceConfig(instanceId: number): Promise<OpenVPNGatewayInternalConfig>
    {
        const config = await this.instanceConfigController.QueryConfig<OpenVPNGatewayInternalConfig>(instanceId);
        return config!;
    }

    public async ReadInstanceLogs(instanceContext: InstanceContext)
    {
        const instanceDir = this.instancesManager.BuildInstanceStoragePath(instanceContext.hostStoragePath, instanceContext.fullInstanceName);

        const log = await this.remoteRootFileSystemManager.ReadTextFile(instanceContext.hostId, path.join(instanceDir, "openvpn.log"));
        return log.split("\n").map(this.ParseLogLine.bind(this));
    }

    public async ReadInstanceStatus(instanceContext: InstanceContext)
    {
        const instanceDir = this.instancesManager.BuildInstanceStoragePath(instanceContext.hostStoragePath, instanceContext.fullInstanceName);

        const statusText = await this.remoteRootFileSystemManager.ReadTextFile(instanceContext.hostId, path.join(instanceDir, "openvpn-status.log"));
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

    public async ReadServerConfig(hostId: number, fullInstanceName: string): Promise<OpenVPNServerConfig>
    {
        const parsed = await this.ParseConfig(hostId, fullInstanceName);
        const mdl = new ConfigModel(parsed);

        const data = mdl.WithoutSectionAsDictionary() as any;
        const server = data.server.split(" ");

        return {
            authenticationAlgorithm: data.auth,
            cipher: data.cipher,
            port: data.port,
            protocol: data.proto,
            verbosity: data.verb,
            virtualServerAddressRange: CIDRRange.FromAddressAndSubnetMask(server[0], server[1]).ToString()
        };
    }

    public async RestartServer(hostId: number, fullInstanceName: string)
    {
        const serviceName = this.DeriveSystemDServiceNameFromFullInstanceName(fullInstanceName);
        await this.systemServicesManager.RestartService(hostId, serviceName);
    }

    public async StopServer(hostId: number, fullInstanceName: string)
    {
        const serviceName = this.DeriveSystemDServiceNameFromFullInstanceName(fullInstanceName);
        await this.systemServicesManager.StopService(hostId, serviceName);

        const config = await this.ReadServerConfig(hostId, fullInstanceName);
        await this.hostNATService.RemoveSourceNATRule(hostId, config.virtualServerAddressRange);
    }

    public async UpdateInstanceConfig(instanceId: number, publicEndpointConfig: OpenVPNGatewayPublicEndpointConfig)
    {
        const config = await this.ReadInstanceConfig(instanceId);

        config.publicEndpoint = publicEndpointConfig;

        await this.instanceConfigController.UpdateOrInsertConfig(instanceId, config);
    }

    public async UpdateServerConfig(hostId: number, fullInstanceName: string, config: OpenVPNServerConfig)
    {
        const oldConfig = await this.ReadServerConfig(hostId, fullInstanceName);
        if(oldConfig.virtualServerAddressRange !== config.virtualServerAddressRange)
        {
            const serviceName = this.DeriveSystemDServiceNameFromFullInstanceName(fullInstanceName);
            const isRunning = await this.systemServicesManager.IsServiceActive(hostId, serviceName);
            if(isRunning)
            {
                await this.hostNATService.RemoveSourceNATRule(hostId, oldConfig.virtualServerAddressRange);
                await this.hostNATService.AddSourceNATRule(hostId, config.virtualServerAddressRange);
            }
        }

        const range = new CIDRRange(config.virtualServerAddressRange);

        const parsed = await this.ParseConfig(hostId, fullInstanceName);
        const mdl = new ConfigModel(parsed);
        mdl.SetProperties("", {
            auth: config.authenticationAlgorithm,
            cipher: config.cipher,
            port: config.port,
            proto: config.protocol,
            verb: config.verbosity,
            server: range.netAddress + " " + range.GenerateSubnetMask(),
        });

        class OpenVPNConfigWriter extends ConfigWriter
        {
            protected KeyValueEntryToString(entry: KeyValueEntry)
            {
                if(entry.value === null)
                    return entry.key;
                return entry.key + " " + entry.value;
            }
        }

        const configPath = this.BuildConfigPath(fullInstanceName);

        const writer = new OpenVPNConfigWriter(openVPNConfigDialect, (filePath, content) => this.remoteRootFileSystemManager.WriteTextFile(hostId, filePath, content));
        await writer.Write(configPath, parsed);
    }

    //Private methods
    private DeriveSystemDServiceNameFromFullInstanceName(fullInstanceName: string)
    {
        const name = this.instancesManager.DeriveInstanceFileNameFromUniqueInstanceName(fullInstanceName);
        return "openvpn-server@" + name;
    }

    private ParseConfig(hostId: number, fullInstanceName: string)
    {
        class OpenVPNConfigParser extends ConfigParser
        {
            protected ParseKeyValue(line: string): KeyValueEntry
            {
                const parts = line.split(" ");
                if(parts.length === 1)
                    return {
                        type: "KeyValue",
                        key: parts[0],
                        value: null
                    };
                if(parts.length === 2)
                    return {
                        type: "KeyValue",
                        key: parts[0],
                        value: parts[1],
                    };
                else if(parts.length === 3)
                    return {
                        type: "KeyValue",
                        key: parts[0],
                        value: parts[1] + " " + parts[2]
                    }
                throw new Error("Can't parse line: " + line);
            }
        }

        const configPath = this.BuildConfigPath(fullInstanceName);

        const cfgParser = new OpenVPNConfigParser(openVPNConfigDialect);
        return cfgParser.Parse(hostId, configPath);
    }

    private ParseLogLine(line: string): OpenVPNGatewayLogEntry
    {
        return {
            message: line
        };
    }
}