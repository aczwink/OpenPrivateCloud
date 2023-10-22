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
import crypto from "crypto";
import path from "path";
import { Injectable } from "acts-util-node";
import { ResourcesManager } from "../../services/ResourcesManager";
import { ModulesManager } from "../../services/ModulesManager";
import { RemoteFileSystemManager } from "../../services/RemoteFileSystemManager";
import { SystemServicesManager } from "../../services/SystemServicesManager";
import { MySQLClient } from "../database-services/MySQLClient";
import { DeploymentContext } from "../ResourceProvider";
import { ApacheManager } from "./ApacheManager";
import { UsersController } from "../../data-access/UsersController";
import { RemoteCommandExecutor } from "../../services/RemoteCommandExecutor";
import { NextcloudProperties } from "./Properties";
import { LightweightResourceReference } from "../../common/ResourceReference";
import { UsersManager } from "../../services/UsersManager";
 
@Injectable
export class NextcloudManager
{
    constructor(private resourcesManager: ResourcesManager, private apacheManager: ApacheManager, private systemServicesManager: SystemServicesManager,
        private modulesManager: ModulesManager, private remoteFileSystemManager: RemoteFileSystemManager, private usersManager: UsersManager,
        private usersController: UsersController, private remoteCommandExecutor: RemoteCommandExecutor)
    {
    }

    //Public methods
    public async DeleteResource(resourceReference: LightweightResourceReference)
    {
        const hostId = resourceReference.hostId;
        const siteName = this.BuildUniqueResourceName(resourceReference);

        await this.apacheManager.DisableSite(hostId, siteName);
        await this.systemServicesManager.RestartService(hostId, "apache2");
        await this.apacheManager.DeleteSite(hostId, siteName);

        const dbName = this.BuildUniqueResourceName(resourceReference);
        const dbUser = dbName;
        const client = MySQLClient.CreateStandardHostClient(hostId);
        await client.DropDatabase(dbName);
        await client.DropUser(dbUser, "localhost");

        await this.resourcesManager.RemoveResourceStorageDirectory(resourceReference);
    }

    public async ProvideResource(instanceProperties: NextcloudProperties, context: DeploymentContext)
    {
        await this.modulesManager.EnsureModuleIsInstalled(context.hostId, "apache");
        await this.modulesManager.EnsureModuleIsInstalled(context.hostId, "nextcloud-dependencies");

        const resourceDir = await this.resourcesManager.CreateResourceStorageDirectory(context.resourceReference);
        await this.remoteFileSystemManager.ChangeMode(context.hostId, resourceDir, 0o775);

        await this.DownloadNextcloudApp(context.hostId, resourceDir);

        const dbName = this.BuildUniqueResourceName(context.resourceReference);
        const dbUser = dbName;
        const dbPw = crypto.randomBytes(16).toString("hex");

        await this.SetupDatabase(context.hostId, dbName, dbUser, dbPw);
        await this.SetupNextcloud(context.hostId, resourceDir, dbName, dbUser, dbPw, context.userId);        

        await this.CreateApacheSite(context.resourceReference, resourceDir, context.userId, instanceProperties.certResourceExternalId);
    }

    //Private methods
    private BuildUniqueResourceName(resourceReference: LightweightResourceReference)
    {
        return "opc-rnc-" + resourceReference.id;
    }

    private async CreateApacheSite(resourceReference: LightweightResourceReference, resourceDir: string, userId: number, certResourceExternalId: string)
    {
        const appDir = path.join(resourceDir, "nextcloud");
        const user = await this.usersController.QueryUser(userId);

        throw new Error("use kv cert and not certbot");
        /*const certRef = await this.resourcesManager.CreateResourceReferenceFromExternalId(certResourceExternalId);
        if(certRef === undefined)
            throw new Error("cert resource not found");
        const cert = await this.letsEncryptManager.GetCert(certRef);
        if(cert === undefined)
            throw new Error("cert not found");

        const vh = VirtualHost.Default("*:443", user!.emailAddress);
        vh.properties.documentRoot = appDir;
        vh.properties.mod_ssl = {
            certificateFile: cert.certificatePath,
            keyFile: cert.privateKeyPath,
        };

        vh.directories = [{
            path: appDir,
            allowOverride: "All",
            require: "all granted",
            options: "FollowSymLinks MultiViews",
            moduleConditionals: [
                {
                    moduleName: "mod_dav.c",
                    content: "Dav off",
                }
            ],
        }];

        const hostId = resourceReference.hostId;
        const siteName = this.BuildUniqueResourceName(resourceReference);
        await this.apacheManager.EnableModule(hostId, "ssl");
        await this.apacheManager.CreateSite(hostId, siteName, vh);
        await this.apacheManager.EnableSite(hostId, siteName);

        await this.systemServicesManager.RestartService(hostId, "apache2");*/
    }

    private async DownloadNextcloudApp(hostId: number, instanceDir: string)
    {
        const shell = await this.remoteCommandExecutor.SpawnShell(hostId);
        await shell.ChangeDirectory(instanceDir);

        const commands = [
            ["wget", "https://download.nextcloud.com/server/releases/latest.zip"],
            ["unzip", "latest.zip"],
            ["rm", "latest.zip"],
            ["mkdir", "data"],
            ["sudo", "chown", "-R", "www-data:www-data", instanceDir]
        ];

        for (const command of commands)
        {
            await shell.ExecuteCommand(command);
        }
        await shell.Close();
    }

    private async SetupDatabase(hostId: number, dbName: string, dbUser: string, dbPw: string)
    {
        const client = MySQLClient.CreateStandardHostClient(hostId);
        await client.CreateDatabase(dbName);
        await client.CreateUser(dbUser, "localhost", dbPw);
        await client.GrantPrivileges(dbUser, "localhost", {
            hasGrant: false,
            privilegeTypes: ["ALL PRIVILEGES"],
            scope: dbName + ".*"
        });
    }

    private async SetupNextcloud(hostId: number, instanceDir: string, dbName: string, dbUser: string, dbPw: string, userId: number)
    {
        const appDir = path.join(instanceDir, "nextcloud");
        const dataDir = path.join(instanceDir, "data");
        const user = await this.usersController.QueryUser(userId);
        const sambaPW = await this.usersManager.QuerySambaPassword(userId);

        const cmd = [
            "sudo", "-u", "www-data", "php", "occ", "maintenance:install",
            "--data-dir", '"' + dataDir + '"',
            "--database", '"mysql"',
            "--database-name", '"' + dbName + '"',
            "--database-user", '"' + dbUser + '"',
            "--database-pass", '"' + dbPw + '"',
            "--admin-user", '"' + user!.emailAddress + '"',
            "--admin-pass", '"' + sambaPW + '"',
        ];

        await this.remoteCommandExecutor.ExecuteCommand(cmd, hostId, { workingDirectory: appDir });
    }
}