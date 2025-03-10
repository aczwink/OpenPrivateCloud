/**
 * OpenPrivateCloud
 * Copyright (C) 2023-2025 Amir Czwink (amir130@hotmail.de)
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
import { ConfigDialect } from "../../../common/config/ConfigDialect";
import { ConfigModel } from "../../../common/config/ConfigModel";
import { ConfigParser } from "../../../common/config/ConfigParser";
import { ConfigWriter } from "../../../common/config/ConfigWriter";
import { HostUsersManager } from "../../../services/HostUsersManager";
import { ResourcesManager } from "../../../services/ResourcesManager";
import { ModulesManager } from "../../../services/ModulesManager";
import { RemoteCommandExecutor } from "../../../services/RemoteCommandExecutor";
import { RemoteFileSystemManager } from "../../../services/RemoteFileSystemManager";
import { RemoteRootFileSystemManager } from "../../../services/RemoteRootFileSystemManager";
import { SystemServicesManager } from "../../../services/SystemServicesManager";
import { DeploymentContext } from "../../ResourceProvider";
import { MariadbProperties } from "./MariadbProperties";
import { MariaDBInterface } from "./MariaDBInterface";
import { MySQLClient, MySQLGrant } from "../MySQLClient";
import { LightweightResourceReference, ResourceReference } from "../../../common/ResourceReference";

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
export class MariaDBHostManager implements MariaDBInterface
{
    constructor(private remoteCommandExecutor: RemoteCommandExecutor, private modulesManager: ModulesManager, private resourcesManager: ResourcesManager,
        private remoteFileSystemManager: RemoteFileSystemManager, private hostUsersManager: HostUsersManager,
        private remoteRootFileSystemManager: RemoteRootFileSystemManager, private systemServicesManager: SystemServicesManager)
    {
    }

    //Public methods
    public async AddUserPermission(resourceReference: LightweightResourceReference, userName: string, hostName: string, permission: MySQLGrant): Promise<void>
    {
        const client = MySQLClient.CreateStandardHostClient(resourceReference.hostId);
        await client.GrantPrivileges(userName, hostName, permission);
    }
    
    public async CheckAllDatabases(resourceReference: LightweightResourceReference): Promise<string> 
    {
        const result = await this.remoteCommandExecutor.ExecuteBufferedCommand(["sudo", "mysqlcheck", "--all-databases", "-u", "root"], resourceReference.hostId);
        return result.stdOut;
    }

    public async CreateDatabase(resourceReference: LightweightResourceReference, databaseName: string): Promise<void>
    {
        const client = MySQLClient.CreateStandardHostClient(resourceReference.hostId);
        await client.CreateDatabase(databaseName);
    }

    public async CreateUser(resourceReference: LightweightResourceReference, userName: string, hostName: string, password: string): Promise<void>
    {
        const client = MySQLClient.CreateStandardHostClient(resourceReference.hostId);
        await client.CreateUser(userName, hostName, password);
    }

    public async DeleteResource(resourceReference: ResourceReference): Promise<void>
    {
        const hostId = resourceReference.hostId;

        await this.systemServicesManager.StopService(hostId, "mariadb");
        await this.modulesManager.Uninstall(hostId, "mariadb");

        await this.resourcesManager.RemoveResourceStorageDirectory(resourceReference);
    }

    public async DeleteUser(resourceReference: LightweightResourceReference, userName: string, hostName: string): Promise<void>
    {
        const client = MySQLClient.CreateStandardHostClient(resourceReference.hostId);
        await client.DropUser(userName, hostName);
    }

    public async DeleteDatabase(resourceReference: LightweightResourceReference, databaseName: string): Promise<void>
    {
        const client = MySQLClient.CreateStandardHostClient(resourceReference.hostId);
        await client.DropDatabase(databaseName);
    }

    public async ExecuteSelectQuery(resourceReference: LightweightResourceReference, query: string): Promise<any[]>
    {
        const client = MySQLClient.CreateStandardHostClient(resourceReference.hostId);
        const resultSet = await client.ExecuteSelectQuery(query);
        return resultSet;
    }

    public async ProvideResource(instanceProperties: MariadbProperties, context: DeploymentContext)
    {
        const exists = await this.CheckIfProgramExists(context.hostId, "mysql");
        if(exists)
            throw new Error("MySQL is already installed on this host");

        await this.modulesManager.EnsureModuleIsInstalled(context.hostId, "mariadb");

        const resourceDir = await this.resourcesManager.CreateResourceStorageDirectory(context.resourceReference);
        await this.remoteFileSystemManager.ChangeMode(context.hostId, resourceDir, 0o755);
        const uid = await this.hostUsersManager.ResolveHostUserId(context.hostId, "mysql");
        const gid = await this.hostUsersManager.ResolveHostGroupId(context.hostId, "mysql");
        await this.remoteRootFileSystemManager.ChangeOwnerAndGroup(context.hostId, resourceDir, uid, gid);

        await this.systemServicesManager.StopService(context.hostId, "mariadb");
        //TODO: should actually install a new db
        //await this.remoteCommandExecutor.ExecuteCommand(["sudo", "mysql_install_db", "--user=mysql", "--datadir=" + instanceDir], context.hostId);
        await this.remoteCommandExecutor.ExecuteCommand(["sudo", "rsync", "-av", "/var/lib/mysql", resourceDir], context.hostId);


        const config = await this.QueryMysqldSettings(context.hostId);
        config["bind-address"] = "0.0.0.0";
        config["datadir"] = path.join(resourceDir, "mysql");
        config["default-time-zone"] = '"+00:00"';
        await this.SetMysqldSettings(context.hostId, config);


        await this.systemServicesManager.StartService(context.hostId, "mariadb");
    }

    //Private methods
    private async CheckIfProgramExists(hostId: number, programName: string)
    {
        const result = await this.remoteCommandExecutor.ExecuteBufferedCommandWithExitCode(["which", programName], hostId);
        if(result.exitCode === 1)
            return false;
        return result.stdOut.trimEnd().length > 0;
    }

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