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
import { GlobalInjector } from "acts-util-node";
import xmljs from "xml-js";
import { ShellFrontend } from "../../common/ShellFrontend";
import { RemoteCommandExecutor } from "../../services/RemoteCommandExecutor";

interface Field
{
    _attributes: {
        name: string;
    };
    _text: string;
}

interface Row
{
    field: Field | Field[];
}

export interface MySQLGrant
{
    privilegeTypes: ("ALL PRIVILEGES" | "DELETE" | "SELECT" | "USAGE")[];
    /**
     * *, *.*, database.*, database.table
     */
    scope: string;
    //userName: string;
    //hostName: string;
    /**
     * Can grant or revoke this privilege to other users?
     */
    hasGrant: boolean;
}
 
export class MySQLClient
{
    constructor(private spawnShell: () => Promise<ShellFrontend>, private clientProg: "mysql" | "mariadb", private commandPrefix: string[], private rootPassword: string)
    {
    }

    //Public methods
    public async CreateDatabase(dbName: string)
    {
        await this.ExecuteMySQLQuery("CREATE DATABASE \\`" + dbName + "\\`;");
    }

    public async CreateUser(dbUser: string, hostName: string, dbPw: string)
    {
        await this.ExecuteMySQLQuery("CREATE USER '" + dbUser + "'@'" + hostName + "' IDENTIFIED BY '" + dbPw + "'");
    }

    public async DropDatabase(dbName: string)
    {
        await this.ExecuteMySQLQuery("DROP DATABASE \\`" + dbName + "\\`;");
    }

    public async DropUser(dbUser: string, hostName: string)
    {
        await this.ExecuteMySQLQuery("DROP USER '" + dbUser + "'@'" + hostName + "';");
    }

    public async ExecuteSelectQuery(query: string): Promise<any[]>
    {
        let data = "";

        const shell = await this.spawnShell();
        await shell.StartCommand(this.commandPrefix.concat([this.clientProg, "-u", "root", "-p", "--xml", "-e", '"' + query + '"']));

        await this.LogIn(shell);

        shell.RegisterForDataEvents(chunk => data += chunk);
        await shell.WaitForCommandToFinish();
        shell.RegisterForDataEvents(undefined);

        await shell.Close();

        const obj = xmljs.xml2js(data, { compact: true });
        const resultSet = (obj as any).resultset;

        const rows = Array.isArray(resultSet.row) ? resultSet.row : [resultSet.row];

        return rows.map( (row: Row) => {
            const fields = Array.isArray(row.field) ? row.field : [row.field];
            const resRow: any = {};

            for (const field of fields)
                resRow[field._attributes.name] = field._text;

            return resRow;
        });
    }

    public async GrantPrivileges(dbUser: string, hostName: string, permission: MySQLGrant)
    {
        const privileges = permission.privilegeTypes.join(", ");
        await this.ExecuteMySQLQuery("GRANT " + privileges + " ON " + permission.scope + " TO '" + dbUser + "'@'" + hostName + "'; FLUSH PRIVILEGES;");
    }

    //Private methods
    private async ExecuteMySQLQuery(mysqlQuery: string)
    {
        const shell = await this.spawnShell();
        await shell.StartCommand(this.commandPrefix.concat([this.clientProg, "-u", "root", "-p", "-e", '"' + mysqlQuery + '"']));

        await this.LogIn(shell);

        await shell.WaitForCommandToFinish();
        await shell.Close();
    }

    private async LogIn(shell: ShellFrontend)
    {
        await new Promise( resolve => {
            setTimeout(resolve, 1000);
        }); //wait a little for the password prompt
        shell.SendInputLine(this.rootPassword);
    }

    //Class functions
    public static CreateStandardHostClient(hostId: number)
    {
        return new MySQLClient(() => GlobalInjector.Resolve(RemoteCommandExecutor).SpawnShell(hostId), "mysql", ["sudo"], "");
    }
}