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
import { Injectable } from "acts-util-node";
import { ResourcesManager } from "../../services/ResourcesManager";
import { MySQLClient } from "../database-services/MySQLClient";
import { DeploymentContext } from "../ResourceProvider";
import { UsersController } from "../../data-access/UsersController";
import { NextcloudProperties } from "./Properties";
import { LightweightResourceReference } from "../../common/ResourceReference";
import { UsersManager } from "../../services/UsersManager";
import { ManagedDockerContainerManager } from "../compute-services/ManagedDockerContainerManager";
import { ResourceDependenciesController } from "../../data-access/ResourceDependenciesController";
 
@Injectable
export class NextcloudManager
{
    constructor(private resourcesManager: ResourcesManager, private usersManager: UsersManager,
        private usersController: UsersController, private managedDockerContainerManager: ManagedDockerContainerManager,
        private resourceDependenciesController: ResourceDependenciesController)
    {
    }

    //Public methods
    public async DeleteResource(resourceReference: LightweightResourceReference)
    {
        //TODO: this.DeleteDatabaseAndUser
        await this.managedDockerContainerManager.DestroyContainer(resourceReference);
        await this.resourcesManager.RemoveResourceStorageDirectory(resourceReference);
    }

    public async RequestInfo(resourceReference: LightweightResourceReference)
    {
        const info = await this.managedDockerContainerManager.ExtractContainerInfo(resourceReference);

        return {
            ...info,
            port: 80
        };
    }

    public async ProvideResource(instanceProperties: NextcloudProperties, context: DeploymentContext)
    {
        await this.resourcesManager.CreateResourceStorageDirectory(context.resourceReference);

        //TODO: mysql setup this.SetupDatabase()
        //TODO: SSL encryption

        const vNetRef = await this.resourcesManager.CreateResourceReferenceFromExternalId(instanceProperties.vnetResourceExternalId);
        await this.resourceDependenciesController.SetResourceDependencies(context.resourceReference.id, [vNetRef!.id]);

        const dockerNetwork = await this.managedDockerContainerManager.ResolveVNetToDockerNetwork(vNetRef!);

        const userName = await this.usersManager.QueryUsersName(context.opcUserId);
        const sambaPW = await this.usersManager.QuerySambaPassword(context.opcUserId);

        await this.managedDockerContainerManager.EnsureContainerIsRunning(context.resourceReference, {
            additionalHosts: [],
            capabilities: [],
            dnsSearchDomains: [],
            dnsServers: [dockerNetwork.primaryDNS_Server],
            env: [
                {
                    varName: "NEXTCLOUD_ADMIN_USER",
                    value: userName,
                },
                {
                    varName: "NEXTCLOUD_ADMIN_PASSWORD",
                    value: sambaPW!
                },
                {
                    varName: "NEXTCLOUD_TRUSTED_DOMAINS",
                    value: instanceProperties.trustedDomain
                },
                {
                    varName: "SQLITE_DATABASE",
                    value: this.BuildUniqueDatabaseName(context.resourceReference)
                }
            ],
            imageName: "nextcloud",
            macAddress: this.managedDockerContainerManager.CreateMAC_Address(context.resourceReference.id),
            networkName: dockerNetwork.name,
            portMap: [],
            privileged: false,
            removeOnExit: false,
            restartPolicy: "always",
            volumes: [
                //TODO: volumes
            ],
        });
    }

    //Private methods
    private BuildUniqueDatabaseName(resourceReference: LightweightResourceReference)
    {
        return "opc-rnc-" + resourceReference.id;
    }

    private DeleteDatabaseAndUser()
    {
        /*const dbName = this.BuildUniqueResourceName(resourceReference);
        const dbUser = dbName;
        const client = MySQLClient.CreateStandardHostClient(resourceReference.hostId);
        await client.DropDatabase(dbName);
        await client.DropUser(dbUser, "localhost");*/
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
}