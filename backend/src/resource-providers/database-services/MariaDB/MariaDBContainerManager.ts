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
import { Injectable } from "acts-util-node";
import { DockerContainerConfig, DockerManager } from "../../compute-services/DockerManager";
import { DeploymentContext } from "../../ResourceProvider";
import { MySQLClient, MySQLGrant } from "../MySQLClient";
import { MariaDBInterface } from "./MariaDBInterface";
import { MariadbProperties } from "./MariadbProperties";
import { LightweightResourceReference } from "../../../common/ResourceReference";

@Injectable
export class MariaDBContainerManager implements MariaDBInterface
{
    constructor(private dockerManager: DockerManager)
    {
    }

    //Public methods
    public async AddUserPermission(resourceReference: LightweightResourceReference, userName: string, hostName: string, permission: MySQLGrant): Promise<void>
    {
        const client = this.CreateClient(resourceReference);
        await client.GrantPrivileges(userName, hostName, permission);
    }

    public async CheckAllDatabases(resourceReference: LightweightResourceReference): Promise<string>
    {
        const containerName = this.DeriveContainerName(resourceReference);
        const shell = await this.dockerManager.SpawnShell(resourceReference.hostId, containerName);

        await shell.StartCommand(["mariadbcheck", "--all-databases", "-u", "root", "-p"]);
        await new Promise( resolve => {
            setTimeout(resolve, 1000);
        }); //wait a little for the password prompt
        shell.SendInputLine("openprivatecloud" /*TODO: PW*/);

        let data = "";
        shell.RegisterForDataEvents(chunk => data += chunk);
        await shell.WaitForCommandToFinish();
        shell.RegisterForDataEvents(undefined);

        await shell.Close();

        return data;
    }

    public async CreateDatabase(resourceReference: LightweightResourceReference, databaseName: string): Promise<void>
    {
        const client = this.CreateClient(resourceReference);
        await client.CreateDatabase(databaseName);
    }

    public async CreateUser(resourceReference: LightweightResourceReference, userName: string, hostName: string, password: string): Promise<void>
    {
        const client = this.CreateClient(resourceReference);
        await client.CreateUser(userName, hostName, password);
    }

    public async DeleteResource(resourceReference: LightweightResourceReference): Promise<void>
    {
        const containerName = this.DeriveContainerName(resourceReference);
        const containerInfo = await this.dockerManager.InspectContainer(resourceReference.hostId, containerName);

        if(containerInfo!.State.Running)
            await this.dockerManager.StopContainer(resourceReference.hostId, containerName);

        await this.dockerManager.DeleteContainer(resourceReference.hostId, containerName);
    }

    public async DeleteUser(resourceReference: LightweightResourceReference, userName: string, hostName: string): Promise<void>
    {
        const client = this.CreateClient(resourceReference);
        await client.DropUser(userName, hostName);
    }

    public async ExecuteSelectQuery(resourceReference: LightweightResourceReference, query: string): Promise<any[]>
    {
        const client = this.CreateClient(resourceReference);
        const resultSet = await client.ExecuteSelectQuery(query);
        return resultSet;
    }

    public async ProvideResource(instanceProperties: MariadbProperties, context: DeploymentContext)
    {
        throw new Error("TODO: MISSING vnetResourceExternalId");
        const config: DockerContainerConfig = {
            additionalHosts: [],
            capabilities: [],
            dnsSearchDomains: [],
            dnsServers: [],
            env: [
                {
                    varName: "MARIADB_ROOT_PASSWORD",
                    value: "openprivatecloud" //TODO: PW
                }
            ],
            imageName: "mariadb",
            networkName: "TODO",
            portMap: [],
            restartPolicy: "always",
            volumes: [],
        };
        const containerName = this.DeriveContainerName(context.resourceReference);
        await this.dockerManager.CreateContainerInstanceAndStart(context.hostId, containerName, config);
    }

    //Private methods
    private CreateClient(resourceReference: LightweightResourceReference)
    {
        const containerName = this.DeriveContainerName(resourceReference);
        return new MySQLClient(() => this.dockerManager.SpawnShell(resourceReference.hostId, containerName), "mariadb", [], "openprivatecloud"); //TODO: pw
    }

    private DeriveContainerName(resourceReference: LightweightResourceReference)
    {
        return "opc-rmariadbc-" + resourceReference.id;
    }
}