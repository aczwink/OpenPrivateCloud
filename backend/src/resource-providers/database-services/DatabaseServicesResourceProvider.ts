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
import path from "path";
import { Injectable } from "acts-util-node";
import { resourceProviders } from "openprivatecloud-common";
import { ConfigDialect } from "../../common/config/ConfigDialect";
import { ConfigModel } from "../../common/config/ConfigModel";
import { ConfigParser } from "../../common/config/ConfigParser";
import { ConfigWriter } from "../../common/config/ConfigWriter";
import { InstancesManager } from "../../services/InstancesManager";
import { ModulesManager } from "../../services/ModulesManager";
import { RemoteCommandExecutor } from "../../services/RemoteCommandExecutor";
import { RemoteRootFileSystemManager } from "../../services/RemoteRootFileSystemManager";
import { SystemServicesManager } from "../../services/SystemServicesManager";
import { DeploymentContext, DeploymentResult, ResourceDeletionError, ResourceProvider, ResourceTypeDefinition } from "../ResourceProvider";
import { MariadbProperties } from "./MariadbProperties";
import { RemoteFileSystemManager } from "../../services/RemoteFileSystemManager";
import { HostUsersManager } from "../../services/HostUsersManager";
import { HostMySQLQueryService } from "./HostMySQLQueryService";
import { InstanceContext } from "../../common/InstanceContext";

interface MysqldSettings
{
    "bind-address": string;
    datadir: string;
    "default-time-zone"?: string;
}

const mariadbConfDialect: ConfigDialect = {
    commentInitiators: ["#"],
};

export class MariaDBConfigParser extends ConfigParser
{
    //Protected methods
    protected FileNameMatchesIncludeDir(fileName: string): boolean
    {
        return fileName.endsWith(".cnf");
    }

    protected ParseIncludeDir(line: string): string | undefined
    {
        const includeDirPattern = /\!includedir ([a-z./]+)$/;
        const match = line.match(includeDirPattern);
        if(match !== null)
            return match[1];
        return undefined;
    }
}

  
@Injectable
export class DatabaseServicesResourceProvider implements ResourceProvider<MariadbProperties>
{
    constructor(private modulesManager: ModulesManager, private remoteRootFileSystemManager: RemoteRootFileSystemManager,
        private systemServicesManager: SystemServicesManager, private instancesManager: InstancesManager, private remoteCommandExecutor: RemoteCommandExecutor,
        private remoteFileSystemManager: RemoteFileSystemManager, private hostUsersManager: HostUsersManager, private hostMySQLQueryService: HostMySQLQueryService)
    {
    }

    //Properties
    public get name(): string
    {
        return resourceProviders.databaseServices.name;
    }

    public get resourceTypeDefinitions(): ResourceTypeDefinition[]
    {
        return [
            {
                healthCheckSchedule: {
                    type: "daily",
                    atHour: 3,
                },
                fileSystemType: "ext4",
                schemaName: "MariadbProperties"
            }
        ];
    }

    //Public methods
    public async CheckInstanceAvailability(hostId: number, fullInstanceName: string): Promise<void>
    {
        const warningCount = await this.hostMySQLQueryService.ExecuteSelectQuery(hostId, "SELECT @@warning_count;");
        const errorCount = await this.hostMySQLQueryService.ExecuteSelectQuery(hostId, "SELECT @@error_count;");

        if(parseInt(warningCount.row.field._text) != 0)
            throw new Error("Warnings are reported on the database");
        if(parseInt(errorCount.row.field._text) != 0)
            throw new Error("Warnings are reported on the database");
    }

    public async CheckInstanceHealth(hostId: number, fullInstanceName: string): Promise<void>
    {
        const result = await this.remoteCommandExecutor.ExecuteBufferedCommand(["sudo", "mysqlcheck", "--all-databases", "-u", "root"], hostId);

        const lines = result.stdOut.split("\n");
        const entries = lines.filter(line => line.trim().length > 0).map(line => {
            const parts = line.split(/[ \t]+/);
            if(parts.length != 2)
                throw new Error(parts.toString());
            return parts;
        });

        const errorneous = entries.filter(parts => parts[1] !== "OK");
        if(errorneous.length > 0)
        {
            console.log(errorneous);
            throw new Error("DATABASE PROBLEM!");
        }
    }
    
    public async DeleteResource(instanceContext: InstanceContext): Promise<ResourceDeletionError | null>
    {
        const hostId = instanceContext.hostId;

        await this.systemServicesManager.StopService(hostId, "mariadb");
        await this.modulesManager.Uninstall(hostId, "mariadb");

        await this.instancesManager.RemoveInstanceStorageDirectory(hostId, instanceContext.hostStoragePath, instanceContext.fullInstanceName);

        return null;
    }

    public async InstancePermissionsChanged(instanceContext: InstanceContext): Promise<void>
    {
    }

    public async ProvideResource(instanceProperties: MariadbProperties, context: DeploymentContext): Promise<DeploymentResult>
    {
        await this.modulesManager.EnsureModuleIsInstalled(context.hostId, "mariadb");

        const instanceDir = await this.instancesManager.CreateInstanceStorageDirectory(context.hostId, context.storagePath, context.fullInstanceName);
        await this.remoteFileSystemManager.ChangeMode(context.hostId, instanceDir, 0o755);
        const uid = await this.hostUsersManager.ResolveHostUserId(context.hostId, "mysql");
        const gid = await this.hostUsersManager.ResolveHostGroupId(context.hostId, "mysql");
        await this.remoteRootFileSystemManager.ChangeOwnerAndGroup(context.hostId, instanceDir, uid, gid);

        await this.systemServicesManager.StopService(context.hostId, "mariadb");
        //TODO: should actually install a new db
        //await this.remoteCommandExecutor.ExecuteCommand(["sudo", "mysql_install_db", "--user=mysql", "--datadir=" + instanceDir], context.hostId);
        await this.remoteCommandExecutor.ExecuteCommand(["sudo", "rsync", "-av", "/var/lib/mysql", instanceDir], context.hostId);


        const config = await this.QueryMysqldSettings(context.hostId);
        config["bind-address"] = "0.0.0.0";
        config["datadir"] = path.join(instanceDir, "mysql");
        config["default-time-zone"] = '"+00:00"';
        await this.SetMysqldSettings(context.hostId, config);


        await this.systemServicesManager.StartService(context.hostId, "mariadb");

        return {};
    }

    //Private methods
    private async ParseConfig(hostId: number)
    {
        const parser = new MariaDBConfigParser(mariadbConfDialect);
        const data = await parser.Parse(hostId, "/etc/mysql/my.cnf");

        return data;
    }

    private async QueryMysqldSettings(hostId: number)
    {
        const settings = await this.QuerySettings(hostId);

        return settings.mysqld as unknown as MysqldSettings;
    }
    
    private async QuerySettings(hostId: number)
    {
        const data = await this.ParseConfig(hostId);

        const configModel = new ConfigModel(data);
        return configModel.AsDictionary();
    }

    private async SetMysqldSettings(hostId: number, settings: MysqldSettings)
    {
        class MysqldConfigWriter extends ConfigWriter
        {
            protected override FormatIncludeDir(path: string): string
            {
                return "!includedir " + path;
            }
        }
        const context = this;
        async function WriteFile(filePath: string, content: string): Promise<void>
        {
            const stat = await context.remoteFileSystemManager.QueryStatus(hostId, filePath);
            if(stat.isSymbolicLink())
                await WriteFile(await context.remoteFileSystemManager.ReadLink(hostId, filePath), content);
            else
                await context.remoteRootFileSystemManager.WriteTextFile(hostId, filePath, content);
        }

        const cfg = await this.ParseConfig(hostId);

        const configModel = new ConfigModel(cfg);
        configModel.SetProperties("mysqld", settings as any);

        const cfgWriter = new MysqldConfigWriter(mariadbConfDialect, WriteFile );
        await cfgWriter.Write("/etc/mysql/my.cnf", cfg);
    }
}