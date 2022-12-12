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

export type Command = string[] | {
    type: "redirect-stdout" | "pipe",
    sudo?: boolean;
    source: Command;
    target: Command;
};

export interface SSHConnection
{
    AppendFile(remotePath: string, content: string): Promise<void>;
    ChangeMode(remotePath: string, mode: number): Promise<void>;
    ChangeOwnerAndGroup(remotePath: string, ownerUserId: number, groupUserId: number): Promise<void>;
    Close(): void;
    CreateDirectory(remotePath: string, attributes?: ssh2.InputAttributes): Promise<Error | null>;
    ExecuteInteractiveCommand(command: string, asRoot?: boolean): Promise<ssh2.ClientChannel>;
    ListDirectoryContents(remotePath: string): Promise<ssh2.FileEntry[]>;
    MoveFile(sourcePath: string, targetPath: string): Promise<void>;
    QueryStatus(remotePath: string): Promise<ssh2.Stats>;
    ReadLink(remotePath: string): Promise<string>;
    ReadTextFile(remotePath: string): Promise<string>;
    RemoveDirectory(remotePath: string): Promise<void>;
    SpawnShell(): Promise<ssh2.ClientChannel>;
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

    public async ExecuteInteractiveCommand(commandLine: string, asRoot?: boolean): Promise<ssh2.ClientChannel>
    {
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

        if(asRoot === true)
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

    public MoveFile(sourcePath: string, targetPath: string): Promise<void>
    {
        return new Promise<void>( (resolve, reject) => {
            this.sftp.rename(sourcePath, targetPath, err => {
                if(err)
                    reject(err);
                else
                    resolve();
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

    public ReadLink(remotePath: string): Promise<string>
    {
        return new Promise<string>( (resolve, reject) => {
            this.sftp.readlink(remotePath, (err, target) => {
                if(err)
                    reject(err);
                else
                    resolve(target);
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

    public SpawnShell(): Promise<ssh2.ClientChannel>
    {
        return new Promise<ssh2.ClientChannel>( (resolve, reject) => {
            this.conn.shell( (err, channel) => {
                if(err !== undefined)
                    reject(err);
                else
                    resolve(channel);
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
            conn.on("error", reject);
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