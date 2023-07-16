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
import { InstanceContext } from "../../../common/InstanceContext";
import { ResourcesManager } from "../../../services/ResourcesManager";
import { DockerContainerConfig, DockerManager } from "../../compute-services/DockerManager";
import { DeploymentContext } from "../../ResourceProvider";
import { MySQLClient, MySQLGrant } from "../MySQLClient";
import { MariaDBInterface } from "./MariaDBInterface";
import { MariadbProperties } from "./MariadbProperties";
import { ResourceReference } from "../../../common/InstanceReference";

@Injectable
export class MariaDBContainerManager implements MariaDBInterface
{
    constructor(private dockerManager: DockerManager, private instancesManager: ResourcesManager)
    {
    }

    //Public methods
    public async AddUserPermission(instanceContext: InstanceContext, userName: string, hostName: string, permission: MySQLGrant): Promise<void>
    {
        const client = this.CreateClient(instanceContext);
        await client.GrantPrivileges(userName, hostName, permission);
    }

    public async CheckAllDatabases(instanceContext: InstanceContext): Promise<string>
    {
        const parts = this.instancesManager.TODO_DEPRECATED_ExtractPartsFromFullInstanceName(instanceContext.fullInstanceName);
        const shell = await this.dockerManager.SpawnShell(instanceContext.hostId, parts.instanceName);

        await shell.StartCommand(["mysqlcheck", "--all-databases", "-u", "root", "-p"]);
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

    public async CreateDatabase(instanceContext: InstanceContext, databaseName: string): Promise<void>
    {
        const client = this.CreateClient(instanceContext);
        await client.CreateDatabase(databaseName);
    }

    public async CreateUser(instanceContext: InstanceContext, userName: string, hostName: string, password: string): Promise<void>
    {
        const client = this.CreateClient(instanceContext);
        await client.CreateUser(userName, hostName, password);
    }

    public async DeleteResource(resourceReference: ResourceReference): Promise<void>
    {
        const containerInfo = await this.dockerManager.InspectContainer(resourceReference.hostId, resourceReference.name);

        if(containerInfo!.State.Running)
            await this.dockerManager.StopContainer(resourceReference.hostId, resourceReference.name);

        await this.dockerManager.DeleteContainer(resourceReference.hostId, resourceReference.name);
    }

    public async DeleteUser(instanceContext: InstanceContext, userName: string, hostName: string): Promise<void>
    {
        const client = this.CreateClient(instanceContext);
        await client.DropUser(userName, hostName);
    }

    public async ExecuteSelectQuery(instanceContext: InstanceContext, query: string): Promise<any[]>
    {
        const client = this.CreateClient(instanceContext);
        const resultSet = await client.ExecuteSelectQuery(query);
        return resultSet;
    }

    public async ProvideResource(instanceProperties: MariadbProperties, context: DeploymentContext)
    {
        const config: DockerContainerConfig = {
            env: [
                {
                    varName: "MARIADB_ROOT_PASSWORD",
                    value: "openprivatecloud" //TODO: PW
                }
            ],
            imageName: "mariadb",
            portMap: [],
            restartPolicy: "always",
        };
        await this.dockerManager.CreateContainerInstanceAndStart(context.hostId, instanceProperties.name, config);
    }

    //Private methods
    private CreateClient(instanceContext: InstanceContext)
    {
        const parts = this.instancesManager.TODO_DEPRECATED_ExtractPartsFromFullInstanceName(instanceContext.fullInstanceName);
        return new MySQLClient(() => this.dockerManager.SpawnShell(instanceContext.hostId, parts.instanceName), [], "openprivatecloud"); //TODO: pw
    }
}