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
import xmljs from "xml-js";

import { Injectable } from "acts-util-node";
import { RemoteCommandExecutor } from "../../services/RemoteCommandExecutor";

interface ResultSet
{
    row: {
        field: {
            _text: string
        };
    };
}
 
@Injectable
export class HostMySQLQueryService
{
    constructor(private remoteCommandExecutor: RemoteCommandExecutor)
    {
    }

    //Public methods
    public async CreateDatabase(hostId: number, dbName: string)
    {
        await this.ExecuteMySQLQuery(hostId, "CREATE DATABASE \\`" + dbName + "\\`;");
    }

    public async CreateUserAndGrantPrivileges(hostId: number, dbUser: string, dbPw: string, dbName: string)
    {
        await this.ExecuteMySQLQuery(hostId, "CREATE USER '" + dbUser + "'@'localhost' IDENTIFIED BY '" + dbPw + "'; GRANT ALL PRIVILEGES ON \\`" + dbName + "\\`.* TO '" + dbUser + "'@'localhost'; FLUSH PRIVILEGES;");
    }

    public async DropDatabase(hostId: number, dbName: string)
    {
        await this.ExecuteMySQLQuery(hostId, "DROP DATABASE \\`" + dbName + "\\`;");
    }

    public async DropUser(hostId: number, dbUser: string)
    {
        await this.ExecuteMySQLQuery(hostId, "DROP USER '" + dbUser + "'@'localhost';");
    }

    public async ExecuteSelectQuery(hostId: number, query: string)
    {
        let data = "";

        const shell = await this.remoteCommandExecutor.SpawnShell(hostId);
        await shell.StartCommand(["sudo", "mysql", "-u", "root", "-p", "--xml", "-e", '"' + query + '"']);

        await new Promise( resolve => {
            setTimeout(resolve, 1000);
        }); //wait a little for the password prompt

        shell.RegisterForDataEvents(chunk => data += chunk);
        shell.SendInput("\n");

        await shell.WaitForCommandToFinish();
        shell.RegisterForDataEvents(undefined);
        await shell.Close();

        const obj = xmljs.xml2js(data, { compact: true });
        return (obj as any).resultset as ResultSet;
    }

    //Private methods
    private async ExecuteMySQLQuery(hostId: number, mysqlQuery: string)
    {
        const shell = await this.remoteCommandExecutor.SpawnShell(hostId);
        await shell.StartCommand(["sudo", "mysql", "-u", "root", "-p", "-e", '"' + mysqlQuery + '"']);

        await new Promise( resolve => {
            setTimeout(resolve, 1000);
        }); //wait a little for the password prompt
        shell.SendInput("\n");

        await shell.WaitForCommandToFinish();
        await shell.Close();
    }
}