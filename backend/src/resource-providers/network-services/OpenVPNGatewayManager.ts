/**
 * OpenPrivateCloud
 * Copyright (C) 2019-2022 Amir Czwink (amir130@hotmail.de)
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

export interface OpenVPNGatewayConfig
{
    dnsServerAddress: string;
    domainName: string;
    keySize: number;   
}

const openVPNConfigDialect: ConfigDialect = {
    commentInitiators: ["#"]
}

@Injectable
export class OpenVPNGatewayManager
{
    constructor(private instancesManager: InstancesManager, private instanceConfigController: InstanceConfigController,
        private remoteCommandExecutor: RemoteCommandExecutor, private remoteFileSystemManager: RemoteFileSystemManager,
        private systemServicesManager: SystemServicesManager, private remoteRootFileSystemManager: RemoteRootFileSystemManager)
    {
    }
    
    //Public methods
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
            virtualServerAddress: "10.8.0.0",
            virtualServerSubnetMask: "255.255.255.0",
        };
    }

    public async CreateServerConfig(hostId: number, serverDir: string, fullInstanceName: string, data: OpenVPNServerConfig, certKeyFiles: CertKeyFiles)
    {
        await this.remoteCommandExecutor.ExecuteCommand(["/usr/sbin/openvpn", "--genkey", "--secret", serverDir + "/ta.key"], hostId);

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

server ${data.virtualServerAddress} ${data.virtualServerSubnetMask}
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

    public async GenerateClientConfig(hostId: number, serverDir: string, remoteAddress: string, dnsRedirectAddress: string, fullInstanceName: string, clientCertKeyPaths: CertKeyFiles)
    {
        const cfg = await this.ReadServerConfig(hostId, fullInstanceName);

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

proto ${cfg.protocol}
remote ${remoteAddress} ${cfg.port}
cipher ${cfg.cipher}
verb ${cfg.verbosity}
auth ${cfg.authenticationAlgorithm}
auth-nocache
key-direction 1

redirect-gateway def1
script-security 2
dhcp-option DNS ${dnsRedirectAddress}

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

    public async ReadInstanceConfig(instanceId: number): Promise<OpenVPNGatewayConfig>
    {
        const config = await this.instanceConfigController.QueryConfig<OpenVPNGatewayConfig>(instanceId);
        return config!;
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
            virtualServerAddress: server[0],
            virtualServerSubnetMask: server[1],
        };
    }

    public async UpdateServerConfig(hostId: number, fullInstanceName: string, config: OpenVPNServerConfig)
    {
        const parsed = await this.ParseConfig(hostId, fullInstanceName);
        const mdl = new ConfigModel(parsed);
        mdl.SetProperties("", {
            auth: config.authenticationAlgorithm,
            cipher: config.cipher,
            port: config.port,
            proto: config.protocol,
            verb: config.verbosity,
            server: config.virtualServerAddress + " " + config.virtualServerSubnetMask,
        });

        class OpenVPNConfigWriter extends ConfigWriter
        {
            protected KeyValueEntryToString(entry: KeyValueEntry)
            {
                return entry.key + " " + entry.value;
            }
        }

        const configPath = this.BuildConfigPath(fullInstanceName);

        const writer = new OpenVPNConfigWriter(openVPNConfigDialect, (filePath, content) => this.remoteRootFileSystemManager.WriteTextFile(hostId, filePath, content));
        await writer.Write(configPath, parsed);
    }

    //Private methods
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
}