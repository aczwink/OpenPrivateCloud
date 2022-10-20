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

import ssh2 from "ssh2";
import { Injectable } from "acts-util-node";

interface CommandResult
{
    stdErr: string;
    stdOut: string;
}

export interface SSHConnection
{
    AppendFile(remotePath: string, content: string): Promise<void>;
    ChangeMode(remotePath: string, mode: number): Promise<void>;
    ChangeOwnerAndGroup(remotePath: string, ownerUserId: number, groupUserId: number): Promise<void>;
    Close(): void;
    CreateDirectory(remotePath: string, attributes?: ssh2.InputAttributes): Promise<Error | null>;
    ExecuteBufferedCommand(command: string[]): Promise<CommandResult>;
    ExecuteCommand(command: string[]): Promise<void>;
    ExecuteInteractiveCommand(command: string[]): Promise<ssh2.ClientChannel>;
    ListDirectoryContents(remotePath: string): Promise<ssh2.FileEntry[]>;
    QueryStatus(remotePath: string): Promise<ssh2.Stats>;
    ReadTextFile(remotePath: string): Promise<string>;
    RemoveDirectory(remotePath: string): Promise<void>;
    UnlinkFile(remotePath: string): Promise<void>;
    WriteFile(remotePath: string, content: Buffer): Promise<void>;
}

class SSHConnectionImpl implements SSHConnection
{
    constructor(private conn: ssh2.Client, private sftp: ssh2.SFTPWrapper, private password: string)
    {
    }

    //Public methods
    public async AppendFile(remotePath: string, content: string): Promise<void>
    {
        return new Promise<void>( (resolve, reject) => {
            this.sftp.appendFile(remotePath, content, {
                encoding: "utf-8"
            }, err => {
                if(err)
                    reject(err);
                else
                    resolve();
            });
        });
    }

    public ChangeMode(remotePath: string, mode: number): Promise<void>
    {
        return new Promise<void>( (resolve, reject) => {
            this.sftp.chmod(remotePath, mode, err => {
                if(err)
                    reject(err);
                else
                    resolve();
            });
        });
    }

    public ChangeOwnerAndGroup(remotePath: string, ownerUserId: number, groupUserId: number): Promise<void>
    {
        return new Promise<void>( (resolve, reject) => {
            this.sftp.chown(remotePath, ownerUserId, groupUserId, err => {
                if(err)
                    reject(err);
                else
                    resolve();
            });
        });
    }

    public Close(): void
    {
        this.conn.end();
    }

    public CreateDirectory(remotePath: string, attributes?: ssh2.InputAttributes): Promise<Error | null>
    {
        const attr = attributes === undefined ? {} : attributes;
        return new Promise<Error | null>( (resolve, reject) => {
            this.sftp.mkdir(remotePath, attr, err => {
                if(err)
                    resolve(err);
                else
                    resolve(null);
            });
        });
    }

    public async ExecuteBufferedCommand(command: string[]): Promise<CommandResult>
    {
        const channel = await this.ExecuteInteractiveCommand(command);

        let stdOut = "";
        let stdErr = "";

        await new Promise<void>( (resolve, reject) => {
            channel.stdout.setEncoding("utf-8");
            channel.stderr.setEncoding("utf-8");

            channel.stdout.on("data", (chunk: string) => stdOut += chunk);
            channel.stderr.on("data", (chunk: string) => stdErr += chunk);
            
            channel.on("exit", code => {
                resolve();
            });
        });

        return {
            stdErr,
            stdOut
        };
    }

    public async ExecuteCommand(command: string[]): Promise<void>
    {
        const channel = await this.ExecuteInteractiveCommand(command);
        return new Promise<void>( (resolve, reject) => {
            channel.stdout.setEncoding("utf-8");
            channel.stderr.setEncoding("utf-8");

            channel.stdout.on("data", console.log);
            channel.stderr.on("data", console.error);
            
            channel.on("exit", code => {
                resolve();
            });
        });
    }

    public async ExecuteInteractiveCommand(command: string[]): Promise<ssh2.ClientChannel>
    {
        let writePW = false;
        const sudoCount = command.Values().Filter(x => x === "sudo").Count();
        if( (sudoCount === 1) && (command[0] === "sudo") )
        {
            command.splice(1, 0, "--stdin");
            writePW = true;
        }

        const commandLine = command.join(" ");

        const channel = await new Promise<ssh2.ClientChannel>( (resolve, reject) => {
            this.conn.exec(commandLine, {
                //pty: hasSudo
            }, (err, channel) => {

                if(err)
                    reject(err);
                else
                    resolve(channel);
            });
        });

        if(writePW)
            channel.stdin.write(this.password + "\n");

        return channel;
    }

    public ListDirectoryContents(remotePath: string): Promise<ssh2.FileEntry[]>
    {
        return new Promise<ssh2.FileEntry[]>( (resolve, reject) => {
            this.sftp.readdir(remotePath, (err, list) => {
                if(err)
                    reject(err);
                else
                    resolve(list);
            });
        });
    }

    public QueryStatus(remotePath: string): Promise<ssh2.Stats>
    {
        return new Promise<ssh2.Stats>( (resolve, reject) => {
            this.sftp.lstat(remotePath, (err, stats) => {
                if(err)
                    reject(err);
                else
                    resolve(stats);
            });
        });
    }

    public ReadTextFile(remotePath: string): Promise<string>
    {
        return new Promise<string>( (resolve, reject) => {
            this.sftp.readFile(remotePath, (err, buffer) => {
                if(err)
                    reject(err);
                else
                    resolve(buffer.toString("utf-8"));
            });
        });
    }

    public RemoveDirectory(remotePath: string): Promise<void>
    {
        return new Promise<void>( (resolve, reject) => {
            this.sftp.rmdir(remotePath, err => {
                if(err)
                    reject(err);
                else
                    resolve();
            });
        });
    }

    public UnlinkFile(remotePath: string): Promise<void>
    {
        return new Promise<void>( (resolve, reject) => {
            this.sftp.unlink(remotePath, err => {
                if(err)
                    reject(err);
                else
                    resolve();
            });
        });
    }

    public async WriteFile(remotePath: string, content: Buffer): Promise<void>
    {
        return new Promise<void>( (resolve, reject) => {
            this.sftp.writeFile(remotePath, content, err => {
                if(err)
                    reject(err);
                else
                    resolve();
            });
        });
    }
}

@Injectable
export class SSHService
{
    //Public methods
    public async ConnectWithCredentials(host: string, userName: string, password: string): Promise<SSHConnection>
    {
        const conn = new ssh2.Client();

        await new Promise<void>( (resolve, reject) => {
            conn.on("ready", resolve).connect({
                host,
                username: userName,
                password
            });
        });
        const sftp = await this.GetSFTPWrapper(conn);
        return new SSHConnectionImpl(conn, sftp, password);
    }

    //Private methods
    private GetSFTPWrapper(conn: ssh2.Client)
    {
        return new Promise<ssh2.SFTPWrapper>( (resolve, reject) => {
            conn.sftp((err, sftp) => {
                if(err)
                    reject(err);
                else
                    resolve(sftp);
            });
        });
    }
}